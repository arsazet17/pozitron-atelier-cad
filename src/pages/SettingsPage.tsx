import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db, exportBackup, getNumbering, getProfile, getTech, importBackup, requestPersistentStorage, setSetting } from '../db';
import { DEFAULT_NUMBERING, DEFAULT_TECH, emptyProfile, formatOrderNumber, newMaterial } from '../model/factory';
import { MATERIAL_KIND_LABEL, type AtelierProfile, type LegalForm, type Material, type MaterialKind, type NumberingSettings, type TechSettings, type Unit } from '../model/types';
import { NumberField, SelectField, TextField, TopBar, toast } from '../ui';

const LEGAL_FORMS: LegalForm[] = ['ИП', 'ООО', 'Самозанятый', 'Другое'];
const UNITS: Unit[] = ['м', 'шт', 'компл', 'м²', 'усл'];
const KINDS = Object.keys(MATERIAL_KIND_LABEL) as MaterialKind[];

/** Настройка, которую правят на экране и сохраняют с задержкой */
function useSavedSetting<T>(key: string, load: () => Promise<T>, fallback: T) {
  const [value, setValue] = useState<T | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<T | undefined>(undefined);
  useEffect(() => {
    load().then((v) => {
      latest.current = v;
      setValue(v);
    });
    return () => {
      window.clearTimeout(timer.current);
      if (latest.current !== undefined) void setSetting(key, latest.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (patch: Partial<T>) => {
    const next = { ...(latest.current ?? fallback), ...patch } as T;
    latest.current = next;
    setValue(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void setSetting(key, next), 400);
  };
  return [value, update] as const;
}

function MaterialDialog({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [m, setM] = useState<Material | null>(material);

  useEffect(() => {
    setM(material);
    if (material) ref.current?.showModal();
    else ref.current?.close();
  }, [material]);

  const set = (patch: Partial<Material>) => setM((x) => (x ? { ...x, ...patch } : x));
  const isFabric = m?.kind === 'fabric' || m?.kind === 'lining';

  return (
    <dialog ref={ref} className="sheet" onClose={onClose}>
      {m && (
        <>
          <div className="sheet-body">
            <h2 style={{ margin: 0 }}>Позиция справочника</h2>
            <div className="grid2">
              <SelectField label="Вид" value={m.kind} options={KINDS.map((k) => ({ value: k, label: MATERIAL_KIND_LABEL[k] }))} onChange={(kind) => set({ kind, unit: kind === 'fabric' || kind === 'lining' || kind === 'tape' ? 'м' : m.unit })} />
              <TextField label="Наименование" value={m.name} onChange={(name) => set({ name })} />
              <TextField label="Артикул" value={m.article} onChange={(article) => set({ article })} />
              <SelectField label="Единица" value={m.unit} options={UNITS.map((u) => ({ value: u, label: u }))} onChange={(unit) => set({ unit })} />
              <NumberField label="Цена" suffix={`₽ за ${m.unit}`} value={m.price} onChange={(price) => set({ price: price ?? 0 })} />
              {isFabric && <NumberField label="Ширина рулона" suffix="мм" value={m.rollWidth} onChange={(rollWidth) => set({ rollWidth })} />}
              {isFabric && <NumberField label="Раппорт по вертикали" suffix="мм" value={m.rapport} onChange={(rapport) => set({ rapport: rapport ?? 0 })} />}
            </div>
            {isFabric && (
              <label className="switch">
                <input type="checkbox" checked={!!m.railroaded} onChange={(e) => set({ railroaded: e.target.checked })} />
                Ткань «в высоту» (высота изделия по ширине рулона)
              </label>
            )}
            {isFabric && (
              <label className="switch">
                <input type="color" className="color-input" value={m.color ?? '#c9a25d'} onChange={(e) => set({ color: e.target.value })} />
                Цвет для визуализации
                {m.color && (
                  <button type="button" className="btn small" onClick={() => set({ color: undefined })}>
                    сбросить
                  </button>
                )}
              </label>
            )}
            <TextField label="Примечание" value={m.note} onChange={(note) => set({ note })} />
          </div>
          <div className="sheet-actions">
            {material && (
              <button
                className="btn danger"
                onClick={async () => {
                  if (!confirm(`Удалить «${m.name || 'позицию'}» из справочника?`)) return;
                  await db.materials.delete(m.id);
                  onClose();
                }}
              >
                Удалить
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={onClose}>
              Отмена
            </button>
            <button
              className="btn primary"
              disabled={!m.name.trim()}
              onClick={async () => {
                await db.materials.put({ ...m, name: m.name.trim() });
                onClose();
              }}
            >
              Сохранить
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

export function SettingsPage() {
  const [profile, setProfile] = useSavedSetting<AtelierProfile>('profile', getProfile, emptyProfile());
  const [numbering, setNumbering] = useSavedSetting<NumberingSettings>('numbering', getNumbering, DEFAULT_NUMBERING);
  const [tech, setTech] = useSavedSetting<TechSettings>('tech', getTech, DEFAULT_TECH);
  const materials = useLiveQuery(() => db.materials.orderBy('name').toArray(), []);
  const [editing, setEditing] = useState<Material | null>(null);
  const [persisted, setPersisted] = useState<boolean | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted);
  }, []);

  const doExport = async () => {
    const data = await exportBackup();
    const name = `atelier-cad-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    // На телефоне удобнее «Поделиться»: сохранить в Файлы, отправить себе в мессенджер или на почту
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Резервная копия ПОЗИТРОН АТЕЛЬЕ CAD' });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const doImport = async (f: File) => {
    try {
      const r = await importBackup(JSON.parse(await f.text()));
      toast(`Восстановлено: заказов ${r.orders}, позиций справочника ${r.materials}`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      alert((e as Error).message || 'Не удалось прочитать файл.');
    }
  };

  const p = profile;
  const isOrg = p?.legalForm === 'ООО';

  return (
    <>
      <TopBar title="Настройки" sub="Реквизиты, справочник, резервная копия" />
      <main>
        <div className="section-title">Реквизиты ателье</div>
        {p && (
          <div className="card">
            <p className="small muted" style={{ marginTop: 0 }}>
              Вводятся один раз и подставляются в договоры и документы.
            </p>
            <div className="grid2">
              <TextField label="Наименование" placeholder={isOrg ? 'ООО «…»' : 'ИП Пашкова Наталья Евгеньевна'} value={p.name} onChange={(name) => setProfile({ name })} />
              <SelectField label="Форма" value={p.legalForm} options={LEGAL_FORMS.map((f) => ({ value: f, label: f }))} onChange={(legalForm) => setProfile({ legalForm })} />
              <TextField label="ИНН" inputMode="numeric" value={p.inn} onChange={(inn) => setProfile({ inn })} />
              {isOrg && <TextField label="КПП" inputMode="numeric" value={p.kpp} onChange={(kpp) => setProfile({ kpp })} />}
              <TextField label={isOrg ? 'ОГРН' : 'ОГРНИП'} inputMode="numeric" value={p.ogrn} onChange={(ogrn) => setProfile({ ogrn })} />
              <TextField label="Юридический адрес" value={p.legalAddress} onChange={(legalAddress) => setProfile({ legalAddress })} />
              <TextField label="Банк" value={p.bankName} onChange={(bankName) => setProfile({ bankName })} />
              <TextField label="БИК" inputMode="numeric" value={p.bik} onChange={(bik) => setProfile({ bik })} />
              <TextField label="Расчётный счёт" inputMode="numeric" value={p.account} onChange={(account) => setProfile({ account })} />
              <TextField label="Корр. счёт" inputMode="numeric" value={p.corrAccount} onChange={(corrAccount) => setProfile({ corrAccount })} />
              <TextField label={isOrg ? 'Руководитель (ФИО, должность)' : 'Подписант (ФИО)'} value={p.director} onChange={(director) => setProfile({ director })} />
              <TextField label="Действует на основании" placeholder={isOrg ? 'Устава' : 'Свидетельства / листа записи ЕГРИП'} value={p.authority} onChange={(authority) => setProfile({ authority })} />
              <TextField label="Телефон" type="tel" inputMode="tel" value={p.phone} onChange={(phone) => setProfile({ phone })} />
              <TextField label="Эл. почта" type="email" inputMode="email" value={p.email} onChange={(email) => setProfile({ email })} />
              <TextField label="Сайт" inputMode="url" value={p.site} onChange={(site) => setProfile({ site })} />
            </div>
          </div>
        )}

        <div className="section-title">Нумерация заказов</div>
        {numbering && (
          <div className="card">
            <div className="grid2">
              <NumberField label="Номер следующего заказа" value={numbering.nextNumber} onChange={(v) => v && v > 0 && setNumbering({ nextNumber: Math.floor(v) })} />
              <NumberField label="Цифр в номере" value={numbering.digits} onChange={(v) => v && v >= 1 && v <= 10 && setNumbering({ digits: Math.floor(v) })} />
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Следующий заказ получит номер <b className="num">№ {formatOrderNumber(numbering.nextNumber, numbering.digits)}</b>.
            </p>
          </div>
        )}

        <div className="section-title">Технология пошива (припуски по умолчанию)</div>
        {tech && (
          <div className="card">
            <p className="small muted" style={{ marginTop: 0 }}>
              Полный расход ткани на обработку, мм. Используется во всех расчётах; в отдельном изделии можно изменить.
            </p>
            <div className="grid2">
              <NumberField label="Верх (под тесьму)" suffix="мм" value={tech.topAllowance} onChange={(v) => v !== undefined && v >= 0 && setTech({ topAllowance: Math.round(v) })} />
              <NumberField label="Низ" suffix="мм" value={tech.bottomHem} onChange={(v) => v !== undefined && v >= 0 && setTech({ bottomHem: Math.round(v) })} />
              <NumberField label="Боковой подгиб, на одну сторону" suffix="мм" value={tech.sideHem} onChange={(v) => v !== undefined && v >= 0 && setTech({ sideHem: Math.round(v) })} />
              <NumberField label="Шов стачивания полос, на сторону" suffix="мм" value={tech.seamAllowance} onChange={(v) => v !== undefined && v >= 0 && setTech({ seamAllowance: Math.round(v) })} />
              <NumberField label="Округление метража" suffix="мм" value={tech.roundStep} onChange={(v) => v !== undefined && v >= 0 && setTech({ roundStep: Math.round(v) })} />
              <NumberField label="Запас ткани" suffix="%" value={tech.reservePercent} onChange={(v) => v !== undefined && v >= 0 && v < 100 && setTech({ reservePercent: v })} />
              <NumberField label="Римская: шаг реек" suffix="мм" value={tech.romanRodStep} onChange={(v) => v && v > 50 && setTech({ romanRodStep: Math.round(v) })} />
              <NumberField label="Римская: припуск на кулису" suffix="мм" value={tech.romanPocket} onChange={(v) => v !== undefined && v >= 0 && setTech({ romanPocket: Math.round(v) })} />
            </div>
            <button className="btn small" style={{ marginTop: 12 }} onClick={() => setTech(DEFAULT_TECH)}>
              Вернуть значения по умолчанию
            </button>
          </div>
        )}

        <div className="section-title">Справочник материалов и работ</div>
        <div className="card">
          <p className="small muted" style={{ marginTop: 0 }}>
            Ткани, тесьма, карнизы, фурнитура и работы с ценами. Отсюда смета возьмёт цены (шаг 6), а раскрой — ширину рулона и раппорт (шаг 5).
          </p>
          <div className="mat-list">
            {materials?.map((m) => (
              <div key={m.id} className="mat-item" onClick={() => setEditing(m)} role="button" tabIndex={0}>
                <div>
                  <div style={{ fontWeight: 550 }}>{m.name}</div>
                  <div className="small muted">
                    {MATERIAL_KIND_LABEL[m.kind]}
                    {m.article && ` · арт. ${m.article}`}
                    {m.rollWidth ? ` · рулон ${m.rollWidth} мм` : ''}
                    {m.rapport ? ` · раппорт ${m.rapport} мм` : ''}
                    {m.railroaded ? ' · в высоту' : ''}
                  </div>
                </div>
                <div className="num">
                  {m.price.toLocaleString('ru-RU')} ₽/{m.unit}
                </div>
              </div>
            ))}
            {materials?.length === 0 && <p className="muted small">Справочник пуст.</p>}
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setEditing(newMaterial())}>
            + Добавить позицию
          </button>
        </div>

        <div className="section-title">Данные на устройстве</div>
        <div className="card">
          <p className="small" style={{ marginTop: 0 }}>
            Заказы хранятся только на этом устройстве и работают без интернета. Делайте резервную копию и храните её в облаке или на почте: она нужна, чтобы перенести заказы на другое устройство или восстановить их.
          </p>
          <p className="small muted">
            Защита от автоочистки браузером: {persisted === true ? 'включена ✓' : persisted === false ? 'не разрешена браузером — установите приложение на главный экран' : 'не поддерживается'}
          </p>
          <div className="row">
            <button className="btn primary" onClick={doExport}>
              Сохранить резервную копию
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Восстановить из копии
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <p className="small muted" style={{ textAlign: 'center', marginTop: 24 }}>
          ПОЗИТРОН АТЕЛЬЕ CAD · версия {__APP_VERSION__}
        </p>
      </main>
      <MaterialDialog material={editing} onClose={() => setEditing(null)} />
    </>
  );
}
