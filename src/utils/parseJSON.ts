export const parseJSON = (json: string | undefined | null) => {
  let parsed = undefined;

  if (!json) {
    return parsed;
  }

  try {
    parsed = JSON.parse(json);
  } catch (e) {
    parsed = undefined;
  }

  return parsed;
};
