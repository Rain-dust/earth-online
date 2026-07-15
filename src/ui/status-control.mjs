import { normalizeRuntimeStatus } from "../core/constants.mjs";

const STATUS_OPTIONS = Object.freeze([
  status("stable_operation", "稳定运行", "orbit", "#2f83c5"),
  status("high_load", "高负载", "gauge", "#d87946"),
  status("low_energy", "低能量", "battery-low", "#5f87b7"),
  status("lost_route", "迷航", "compass", "#8a73b8"),
  status("main_quest_push", "主线推进", "route", "#168e82"),
]);

export function getStatusOptions() {
  return STATUS_OPTIONS;
}

export function getStatusControlMarkup(currentStatus) {
  const selectedId = normalizeRuntimeStatus(currentStatus);
  const selected = STATUS_OPTIONS.find((option) => option.id === selectedId) || STATUS_OPTIONS[0];

  return `
    <div class="status-control" data-status-control style="--status-color: ${selected.color}">
      <button class="status-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="切换运行状态">
        <i data-lucide="${selected.icon}" aria-hidden="true"></i>
        <span>${selected.label}</span>
        <i class="status-chevron" data-lucide="chevron-down" aria-hidden="true"></i>
      </button>
      <div class="status-options" role="listbox" aria-label="运行状态" hidden>
        ${STATUS_OPTIONS.map((option) => `
          <button type="button" role="option" data-status-id="${option.id}" aria-selected="${option.id === selected.id}" style="--option-color: ${option.color}">
            <i data-lucide="${option.icon}" aria-hidden="true"></i>
            <span>${option.label}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

export function mountStatusControl(root, {
  currentStatus,
  onStatusChange,
} = {}) {
  root.innerHTML = getStatusControlMarkup(currentStatus);
  const control = root.querySelector("[data-status-control]");
  const trigger = control.querySelector(".status-trigger");
  const listbox = control.querySelector("[role='listbox']");

  const close = ({ restoreFocus = false } = {}) => {
    listbox.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    control.classList.remove("is-open");
    if (restoreFocus) trigger.focus();
  };

  trigger.addEventListener("click", () => {
    const opening = listbox.hidden;
    listbox.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
    control.classList.toggle("is-open", opening);
    if (opening) listbox.querySelector("[aria-selected='true']")?.focus();
  });

  listbox.addEventListener("click", (event) => {
    const optionElement = event.target.closest("[data-status-id]");
    const option = STATUS_OPTIONS.find((item) => item.id === optionElement?.dataset.statusId);

    if (!option) return;
    close();
    onStatusChange?.(option.id);
  });

  control.addEventListener("keydown", (event) => {
    handleStatusControlKeydown(event, close);
  });

  globalThis.lucide?.createIcons({ root: control });
  return control;
}

export function handleStatusControlKeydown(event, close) {
  if (event?.key !== "Escape") return false;

  event.preventDefault?.();
  event.stopPropagation?.();
  close?.({ restoreFocus: true });
  return true;
}

function status(id, label, icon, color) {
  return Object.freeze({ id, label, icon, color });
}
