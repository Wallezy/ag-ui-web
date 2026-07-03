import type { A2UICommand, A2UIComponentNode, A2UISurfaceState } from '../agui/eventTypes';
import { allowedComponents } from './catalog';

const clone = <T,>(value: T): T => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

export const isBinding = (value: unknown): value is { path: string } => {
  return Boolean(value && typeof value === 'object' && 'path' in value && typeof (value as { path: unknown }).path === 'string');
};

export const getByPath = (source: unknown, path: string): unknown => {
  if (!path || path === '/') return source;
  const parts = path.split('/').filter(Boolean);
  let current = source as Record<string, unknown> | unknown[];
  for (const rawPart of parts) {
    const part = rawPart.replaceAll('~1', '/').replaceAll('~0', '~');
    if (Array.isArray(current)) {
      current = current[Number(part)] as Record<string, unknown> | unknown[];
      continue;
    }
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part] as Record<string, unknown> | unknown[];
  }
  return current;
};

export const setByPath = (source: unknown, path: string, value: unknown): unknown => {
  if (!path || path === '/') return clone(value);
  const root = source && typeof source === 'object' ? clone(source) : {};
  const parts = path.split('/').filter(Boolean).map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let current = root as Record<string, unknown>;
  parts.slice(0, -1).forEach((part) => {
    if (!current[part] || typeof current[part] !== 'object') current[part] = {};
    current = current[part] as Record<string, unknown>;
  });
  current[parts[parts.length - 1]] = clone(value);
  return root;
};

export const resolveValue = (value: unknown, dataModel: unknown): unknown => {
  if (isBinding(value)) return getByPath(dataModel, value.path);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, dataModel));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveValue(item, dataModel)]),
    );
  }
  return value;
};

export const validateComponents = (components: A2UIComponentNode[]): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  components.forEach((node) => {
    if (!node.id) errors.push('组件缺少 id');
    if (ids.has(node.id)) errors.push(`组件 id 重复：${node.id}`);
    ids.add(node.id);
    if (!allowedComponents.has(node.component)) errors.push(`组件不在 A2UI catalog 白名单内：${node.component}`);
    node.children?.forEach((childId) => {
      if (!components.some((item) => item.id === childId)) {
        errors.push(`组件 ${node.id} 引用了不存在的 child：${childId}`);
      }
    });
  });
  return errors;
};

export const validateCommand = (command: A2UICommand): string[] => {
  const errors: string[] = [];
  if (command.version !== 'v0.9') errors.push(`不支持的 A2UI version：${command.version}`);
  if ('createSurface' in command) {
    if (!command.createSurface.surfaceId) errors.push('createSurface.surfaceId 不能为空');
    if (!command.createSurface.catalogId) errors.push('createSurface.catalogId 不能为空');
  }
  if ('updateDataModel' in command) {
    if (!command.updateDataModel.surfaceId) errors.push('updateDataModel.surfaceId 不能为空');
    if (!command.updateDataModel.path) errors.push('updateDataModel.path 不能为空');
  }
  if ('updateComponents' in command) {
    if (!command.updateComponents.surfaceId) errors.push('updateComponents.surfaceId 不能为空');
    errors.push(...validateComponents(command.updateComponents.components));
  }
  return errors;
};

export const getCommandSurfaceId = (command: A2UICommand) => {
  if ('createSurface' in command) return command.createSurface.surfaceId;
  if ('updateDataModel' in command) return command.updateDataModel.surfaceId;
  return command.updateComponents.surfaceId;
};

export const applyA2UICommands = (
  surfaces: Record<string, A2UISurfaceState>,
  commands: A2UICommand[],
): Record<string, A2UISurfaceState> => {
  const next = { ...surfaces };
  commands.forEach((command) => {
    const surfaceId = getCommandSurfaceId(command);
    const current = next[surfaceId] ?? {
      surfaceId,
      dataModel: {},
      components: [],
      validationErrors: [],
    };
    const validationErrors = validateCommand(command);
    let surface: A2UISurfaceState = {
      ...current,
      validationErrors: [...current.validationErrors, ...validationErrors],
      updatedAt: Date.now(),
    };
    if ('createSurface' in command) {
      surface = {
        ...surface,
        catalogId: command.createSurface.catalogId,
        validationErrors,
      };
    }
    if ('updateDataModel' in command) {
      surface = {
        ...surface,
        dataModel: setByPath(surface.dataModel, command.updateDataModel.path, command.updateDataModel.value),
      };
    }
    if ('updateComponents' in command) {
      surface = {
        ...surface,
        components: clone(command.updateComponents.components),
      };
    }
    next[surfaceId] = surface;
  });
  return next;
};

export const applyJsonPatch = (source: unknown, patch: unknown): unknown => {
  if (!Array.isArray(patch)) return source;
  let next: unknown = clone(source ?? {});
  patch.forEach((operation) => {
    const item = operation as { op?: string; path?: string; value?: unknown };
    if (!item.path) return;
    if (item.op === 'replace' || item.op === 'add') {
      next = setByPath(next, item.path, item.value);
    }
    if (item.op === 'remove') {
      next = setByPath(next, item.path, undefined);
    }
  });
  return next;
};
