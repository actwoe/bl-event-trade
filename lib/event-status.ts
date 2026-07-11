export type EventStatus = 'scheduled' | 'ongoing' | 'ended';
export type EventFilter = 'all' | EventStatus;

export type SortableEvent = {
  title: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  sortOrder: number;
};

export function getKoreaTodayDateString(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return `${year}-${month}-${day}`;
}

export function getEventStatus(
  eventStartDate: string | null,
  eventEndDate: string | null,
  today: string,
): EventStatus {
  if (eventEndDate && eventEndDate < today) {
    return 'ended';
  }

  if (eventStartDate && eventStartDate > today) {
    return 'scheduled';
  }

  return 'ongoing';
}

export function getEventStatusLabel(status: EventStatus) {
  if (status === 'scheduled') return '예정';
  if (status === 'ended') return '종료';
  return '진행중';
}

export function formatEventDate(value: string | null) {
  if (!value) return '';

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

export function getEventPeriodLabel(
  eventStartDate: string | null,
  eventEndDate: string | null,
) {
  if (eventStartDate && eventEndDate) {
    return `${formatEventDate(eventStartDate)} – ${formatEventDate(eventEndDate)}`;
  }

  if (eventStartDate) {
    return `${formatEventDate(eventStartDate)}부터`;
  }

  if (eventEndDate) {
    return `${formatEventDate(eventEndDate)}까지`;
  }

  return '행사 기간 미정';
}

function compareNullableDate(
  left: string | null,
  right: string | null,
  direction: 'asc' | 'desc',
) {
  if (left && right) {
    return direction === 'asc'
      ? left.localeCompare(right)
      : right.localeCompare(left);
  }

  if (left) return -1;
  if (right) return 1;
  return 0;
}

function getStatusSortIndex(status: EventStatus) {
  if (status === 'ongoing') return 0;
  if (status === 'scheduled') return 1;
  return 2;
}

export function compareEventsByStatus(
  left: SortableEvent,
  right: SortableEvent,
  today: string,
) {
  const leftStatus = getEventStatus(
    left.eventStartDate,
    left.eventEndDate,
    today,
  );
  const rightStatus = getEventStatus(
    right.eventStartDate,
    right.eventEndDate,
    today,
  );

  const statusDiff =
    getStatusSortIndex(leftStatus) - getStatusSortIndex(rightStatus);

  if (statusDiff !== 0) {
    return statusDiff;
  }

  if (leftStatus === 'scheduled') {
    const startDiff = compareNullableDate(
      left.eventStartDate,
      right.eventStartDate,
      'asc',
    );

    if (startDiff !== 0) return startDiff;
  }

  if (leftStatus === 'ongoing') {
    const endDiff = compareNullableDate(
      left.eventEndDate,
      right.eventEndDate,
      'asc',
    );

    if (endDiff !== 0) return endDiff;
  }

  if (leftStatus === 'ended') {
    const endDiff = compareNullableDate(
      left.eventEndDate,
      right.eventEndDate,
      'desc',
    );

    if (endDiff !== 0) return endDiff;
  }

  const sortDiff = left.sortOrder - right.sortOrder;

  if (sortDiff !== 0) {
    return sortDiff;
  }

  return left.title.localeCompare(right.title, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
}
