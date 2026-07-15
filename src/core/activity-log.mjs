export function appendActivityEvent(save, event) {
  if (!event?.id) {
    return save;
  }

  const events = Array.isArray(save?.activityEvents) ? save.activityEvents : [];

  if (events.some((item) => item?.id === event.id)) {
    return save;
  }

  return {
    ...save,
    activityEvents: [...events, structuredClone(event)],
  };
}
