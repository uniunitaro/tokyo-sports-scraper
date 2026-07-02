import type { AvailabilitySlot, AvailabilitySnapshot } from './types';

type PageProps = {
  snapshot: AvailabilitySnapshot | null;
  filters?: AvailabilityFilters;
};

type AvailabilityFilters = {
  date?: string;
  field?: string;
};

const Page = ({ snapshot, filters = {} }: PageProps) => {
  const availableSlots = snapshot?.slots.filter((slot) => slot.available) ?? [];
  const dateOptions = getDateOptions(availableSlots);
  const fieldOptions = getFieldOptions(availableSlots);
  const filteredSlots = availableSlots.filter((slot) => {
    const fieldKey = getFieldKey(slot);
    return (
      (!filters.date || slot.date === filters.date) &&
      (!filters.field || fieldKey === filters.field)
    );
  });
  const grouped = groupByDate(filteredSlots);
  const parksWithAvailability = new Set(
    availableSlots.map((slot) => `${slot.category}:${slot.parkCode}`),
  ).size;

  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>都立公園 野球場空き状況</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-zinc-50 text-zinc-950">
        <main class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <header class="flex flex-col gap-3 border-zinc-200 border-b pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 class="font-semibold text-2xl tracking-normal">
                都立公園 野球場空き状況
              </h1>
              <p class="mt-1 text-sm text-zinc-600">
                野球・野球（小）の1か月先までの最新スナップショット
              </p>
            </div>
            <div class="text-sm text-zinc-600">
              最終取得:{' '}
              <span class="font-medium text-zinc-900">
                {snapshot ? formatDateTime(snapshot.checkedAt) : '未取得'}
              </span>
            </div>
          </header>

          {!snapshot ? (
            <section class="border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
              まだ空き情報がありません。cronまたは管理用手動取得を実行してください。
            </section>
          ) : (
            <>
              <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="空き枠" value={`${availableSlots.length}件`} />
                <Metric
                  label="空きあり公園"
                  value={`${parksWithAvailability}件`}
                />
                <Metric label="取得公園" value={`${snapshot.parks.length}件`} />
                <Metric
                  label="取得エラー"
                  value={`${snapshot.errors.length}件`}
                />
              </section>

              {snapshot.errors.length > 0 ? (
                <section class="border border-red-200 bg-red-50 px-4 py-3 text-red-950">
                  <h2 class="font-semibold text-base">取得エラー</h2>
                  <ul class="mt-2 grid gap-1 text-sm">
                    {snapshot.errors.slice(0, 12).map((error, index) => (
                      <li>
                        <span class="font-medium">
                          {error.category ?? '-'} {error.parkName ?? ''}
                        </span>{' '}
                        {error.step}: {error.message}
                        <span class="sr-only">{index}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section class="flex flex-col gap-4">
                <div class="flex flex-col gap-1 border-zinc-200 border-b pb-2 sm:flex-row sm:items-end sm:justify-between">
                  <h2 class="font-semibold text-lg">空きあり一覧</h2>
                  <p class="text-sm text-zinc-600">
                    日付順、公園名順、時間帯順に表示
                  </p>
                </div>

                <form
                  action="/"
                  method="get"
                  class="grid gap-3 border border-zinc-200 bg-white p-3 md:grid-cols-[minmax(180px,240px)_minmax(240px,1fr)_auto]"
                >
                  <label class="grid gap-1 text-sm">
                    <span class="font-medium text-zinc-700">日付</span>
                    <select
                      class="h-10 border border-zinc-300 bg-white px-3 text-zinc-950"
                      name="date"
                    >
                      <option value="">すべて</option>
                      {dateOptions.map((date) => (
                        <option value={date} selected={filters.date === date}>
                          {formatDisplayDate(date)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label class="grid gap-1 text-sm">
                    <span class="font-medium text-zinc-700">野球場</span>
                    <select
                      class="h-10 border border-zinc-300 bg-white px-3 text-zinc-950"
                      name="field"
                    >
                      <option value="">すべて</option>
                      {fieldOptions.map((field) => (
                        <option
                          value={field.value}
                          selected={filters.field === field.value}
                        >
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div class="flex items-end gap-2">
                    <button
                      class="h-10 border border-zinc-900 bg-zinc-900 px-4 font-medium text-sm text-white"
                      type="submit"
                    >
                      絞り込み
                    </button>
                    <a
                      class="flex h-10 items-center border border-zinc-300 px-4 font-medium text-sm text-zinc-800"
                      href="/"
                    >
                      解除
                    </a>
                  </div>
                </form>

                {availableSlots.length === 0 ? (
                  <div class="border border-zinc-200 bg-white px-4 py-6 text-center text-zinc-600">
                    現在表示できる空き枠はありません。
                  </div>
                ) : filteredSlots.length === 0 ? (
                  <div class="border border-zinc-200 bg-white px-4 py-6 text-center text-zinc-600">
                    条件に一致する空き枠はありません。
                  </div>
                ) : (
                  <div class="overflow-x-auto border border-zinc-200 bg-white">
                    <table class="min-w-full border-collapse text-sm">
                      <thead class="bg-zinc-100 text-left text-zinc-700">
                        <tr>
                          <Th>日付</Th>
                          <Th>カテゴリ</Th>
                          <Th>公園</Th>
                          <Th>施設</Th>
                          <Th>時間</Th>
                          <Th>空き面数</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(grouped.entries()).map(([date, slots]) =>
                          slots.map((slot) => (
                            <tr class="border-zinc-200 border-t">
                              <td class="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                                {formatDisplayDate(date)}
                              </td>
                              <Td>{slot.category}</Td>
                              <Td>{slot.parkName}</Td>
                              <Td>{slot.facilityName}</Td>
                              <Td>
                                {slot.startTime}-{slot.endTime}
                              </Td>
                              <Td>{slot.availableCount}</Td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </body>
    </html>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div class="border border-zinc-200 bg-white px-4 py-3">
    <div class="text-sm text-zinc-600">{label}</div>
    <div class="mt-1 font-semibold text-2xl">{value}</div>
  </div>
);

const Th = ({ children }: { children: unknown }) => (
  <th class="whitespace-nowrap px-3 py-2 font-semibold">{children}</th>
);

const Td = ({ children }: { children: unknown }) => (
  <td class="whitespace-nowrap px-3 py-2">{children}</td>
);

const groupByDate = (slots: AvailabilitySlot[]) => {
  const map = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const values = map.get(slot.date) ?? [];
    values.push(slot);
    map.set(slot.date, values);
  }
  return map;
};

const getDateOptions = (slots: AvailabilitySlot[]) =>
  Array.from(new Set(slots.map((slot) => slot.date))).sort();

const getFieldOptions = (slots: AvailabilitySlot[]) => {
  const map = new Map<string, string>();
  for (const slot of slots) {
    map.set(
      getFieldKey(slot),
      `${slot.parkName} ${slot.facilityName}（${slot.category}）`,
    );
  }
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
};

const getFieldKey = (slot: AvailabilitySlot) =>
  `${slot.category}:${slot.parkCode}:${slot.facilityCode}`;

const formatDisplayDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${year}/${month}/${day}（${weekday}）`;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value));

export { formatDisplayDate, Page };
