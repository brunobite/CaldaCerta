import { loadSection, saveDraft } from './db.js';

const AUTOSAVE_DEBOUNCE_MS = 800;

function debounce(fn, waitMs) {
  let timeoutId = null;

  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, waitMs);
  };
}

function getFieldKey(field) {
  return field.name || field.id;
}

function getFieldValue(field) {
  if (field.type === 'checkbox') {
    return field.checked;
  }

  if (field.type === 'radio') {
    return field.checked ? field.value : undefined;
  }

  if (field.tagName === 'SELECT' && field.multiple) {
    return Array.from(field.selectedOptions).map((option) => option.value);
  }

  return field.value;
}

function setFieldValue(field, value) {
  if (field.type === 'checkbox') {
    field.checked = Boolean(value);
    return;
  }

  if (field.type === 'radio') {
    field.checked = field.value === value;
    return;
  }

  if (field.tagName === 'SELECT' && field.multiple && Array.isArray(value)) {
    const selectedValues = new Set(value.map(String));
    Array.from(field.options).forEach((option) => {
      option.selected = selectedValues.has(option.value);
    });
    return;
  }

  field.value = value ?? '';
}

export function collectFormData(formElement) {
  if (!formElement) {
    return {};
  }

  const data = {};
  const radioValues = {};
  const fields = formElement.querySelectorAll('input, select, textarea');

  fields.forEach((field) => {
    const key = getFieldKey(field);
    if (!key || field.disabled) {
      return;
    }

    if (field.type === 'radio') {
      if (!(key in radioValues)) {
        radioValues[key] = '';
      }
      if (field.checked) {
        radioValues[key] = field.value;
      }
      return;
    }

    data[key] = getFieldValue(field);
  });

  Object.assign(data, radioValues);
  return data;
}

export function initAutosave(mixId, sectionKey, formElement) {
  if (!mixId || !sectionKey || !formElement) {
    return () => {};
  }

  const persistDraft = debounce(async () => {
    const payload = collectFormData(formElement);
    await saveDraft(mixId, sectionKey, payload);
  }, AUTOSAVE_DEBOUNCE_MS);

  const handler = () => {
    persistDraft();
  };

  formElement.addEventListener('input', handler);
  formElement.addEventListener('change', handler);

  return () => {
    formElement.removeEventListener('input', handler);
    formElement.removeEventListener('change', handler);
  };
}

export async function restoreDraft(mixId, sectionKey, formElement) {
  if (!mixId || !sectionKey || !formElement) {
    return false;
  }

  const savedData = await loadSection(mixId, sectionKey);
  if (!savedData || typeof savedData !== 'object' || Object.keys(savedData).length === 0) {
    return false;
  }

  const fields = formElement.querySelectorAll('input, select, textarea');
  fields.forEach((field) => {
    const key = getFieldKey(field);
    if (!key || !(key in savedData)) {
      return;
    }

    setFieldValue(field, savedData[key]);
  });

  return true;
}
