import AWClient from './awclient';

export const getSettingsFromServer = async () => {
  const { data } = await AWClient.req.get('/0/settings');
  return data;
};

export const updateSettingOnServer = async (key: string, value: string) => {
  console.log({ key, value });
  const headers = { 'Content-Type': 'application/json' };
  const { data } = await AWClient.req.post('/0/settings', { key, value }, headers);
  return data;
};
