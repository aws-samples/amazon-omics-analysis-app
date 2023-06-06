import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
dayjs.extend(duration);
dayjs.extend(utc);

const DEFAULT_FORMAT_DATETIME = 'YYYY-MM-DD HH:mm:ss';
const DEFAULT_FORMAT_TIME = 'HH:mm:ss';

type InputDateType = string | number | null | undefined;

export const formatDatetime = (date: InputDateType): string => {
  return date ? dayjs(date).format(DEFAULT_FORMAT_DATETIME) : '';
};

export const formatTime = (date: InputDateType): string => {
  return date ? dayjs(date).format(DEFAULT_FORMAT_TIME) : '';
};

export const formatFromMilliseconds = (milliseconds: number): string => {
  const sub = dayjs().subtract(milliseconds, 'milliseconds');
  const duration = dayjs.duration(dayjs().diff(sub));
  return dayjs.utc(duration.asMilliseconds()).format(DEFAULT_FORMAT_TIME);
};

export const diffTime = (date1: InputDateType, date2: InputDateType) => {
  const milliseconds = dayjs(date2).diff(date1, 'milliseconds');
  return formatFromMilliseconds(milliseconds);
};
