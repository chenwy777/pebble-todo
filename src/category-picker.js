"use strict";
// A small custom popup keeps colored options consistent on Windows and macOS.
// The backing select remains the single source for form values and change events.
let categoryPopup, categoryPopupTrigger;
function syncCategoryPicker(select) {
  if (!select._picker) {
    const wrapper = document.createElement("div");
    wrapper.className = "category-picker";
    wrapper.dataset.select = select.id;
    select.before(wrapper);
    wrapper.append(select);
    select.classList.add("category-source-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "category-picker-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-controls", "category-popover");
    trigger.setAttribute("aria-expanded", "false");
    wrapper.append(trigger);
    select._picker = trigger;
    trigger.onclick = () => openCategoryPicker(select);
    trigger.onkeydown = (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault(); openCategoryPicker(select);
      }
    };
    select.addEventListener("change", () => syncCategoryPicker(select));
  }
  // Closed pickers belong to the neutral main UI. Color and emoji live in options.
  const category = state.categories.find((item) => item.id === select.value);
  select._picker.textContent = category ? categoryName(category) : select.selectedOptions[0]?.textContent || "";
  select._picker.setAttribute("aria-label", select.getAttribute("aria-label") || t("Category"));
}
function openCategoryPicker(select) {
  if (!categoryPopup) {
    categoryPopup = document.createElement("div");
    categoryPopup.id = "category-popover";
    categoryPopup.setAttribute("popover", "auto");
    categoryPopup.setAttribute("role", "listbox");
    categoryPopup.addEventListener("toggle", (event) => {
      if (event.newState === "closed") categoryPopupTrigger?.setAttribute("aria-expanded", "false");
    });
    categoryPopup.onkeydown = (event) => {
      const options = [...categoryPopup.querySelectorAll('[role="option"]')];
      const current = options.indexOf(document.activeElement);
      let next;
      if (event.key === "ArrowDown") next = (current + 1) % options.length;
      if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = options.length - 1;
      if (next !== undefined) { event.preventDefault(); options[next]?.focus(); }
      else if (event.key === "Escape") { event.preventDefault(); categoryPopup.hidePopover(); categoryPopupTrigger.focus(); }
      else if (event.key.length === 1 && event.key !== " ") {
        const match = options.find((option) => option.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
        if (match) { event.preventDefault(); match.focus(); }
      }
    };
  }
  if (categoryPopup.matches(":popover-open")) categoryPopup.hidePopover();
  (select.closest("dialog") || document.body).append(categoryPopup);
  categoryPopupTrigger = select._picker;
  categoryPopup.innerHTML = [...select.options].map((option) => {
    const category = state.categories.find((item) => item.id === option.value);
    return `<button type="button" role="option" aria-selected="${option.selected}" data-value="${esc(option.value)}" style="color:${category?.color || "var(--ink)"}">${esc(category ? categoryLabel(category) : option.textContent)}</button>`;
  }).join("");
  categoryPopup.onclick = (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;
    categoryPopup.hidePopover();
    categoryPopupTrigger.focus();
    select.value = option.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const rect = select._picker.getBoundingClientRect();
  categoryPopup.style.width = Math.min(260, Math.max(175, rect.width)) + "px";
  categoryPopup.showPopover();
  const popup = categoryPopup.getBoundingClientRect();
  categoryPopup.style.left = Math.max(8, Math.min(rect.left, innerWidth - popup.width - 8)) + "px";
  categoryPopup.style.top = (rect.bottom + popup.height + 8 < innerHeight ? rect.bottom + 5 : Math.max(8, rect.top - popup.height - 5)) + "px";
  select._picker.setAttribute("aria-expanded", "true");
  categoryPopup.querySelector('[aria-selected="true"]')?.focus();
}
