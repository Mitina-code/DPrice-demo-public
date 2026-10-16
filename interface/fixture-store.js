// Presentation-only access to captured results. No network or pricing engine.
export function createOfflineApi(data) {
  const clone = (value) => {
    if (value === undefined) throw new ApiError('offline_unavailable');
    return JSON.parse(JSON.stringify(value));
  };
  class ApiError extends Error {
    constructor(key, params = {}, status = 0) {
      super(key); this.key = key; this.params = params; this.status = status;
    }
  }
  const unavailable = async () => { throw new ApiError('offline_readonly'); };
  const project = (id) => {
    if (!data.projects[String(id)]) throw new ApiError('offline_unavailable');
    return data.projects[String(id)];
  };
  const captured = (id, options = {}) => {
    const record = project(id).algorithms[options.algorithm || 'dco-neutral'];
    if (!record) throw new ApiError('offline_unavailable');
    const context = record.units.context;
    if ((options.inventoryVersionId != null && String(options.inventoryVersionId) !== context.inventory_version_id)
      || (options.asOfUtc && options.asOfUtc !== context.as_of_utc)) {
      throw new ApiError('offline_fixed_date');
    }
    return record;
  };
  const same = (left, right) => String(left) === String(right);
  function matches(row, filters = {}) {
    return Object.entries(filters).every(([key, value]) => {
      if (value === '' || value == null) return true;
      const h = row.hierarchy || {};
      switch (key) {
        case 'identity': return [row.unit_number, row.unit_external_id]
          .some((text) => String(text || '').toLocaleLowerCase().includes(String(value).toLocaleLowerCase()));
        case 'phase': case 'building': case 'section': case 'floor':
        case 'phase_id': case 'building_id': case 'section_id': case 'floor_id':
          return same(h[key], value);
        case 'property_type': case 'rooms_value': return same(row[key], value);
        case 'commercial_status': return same(row.commercial?.display_state, value);
        case 'manual_control': return same(row.commercial?.manual_control, value);
        case 'readiness': return same(row.readiness?.state, value);
        case 'calculation_readiness': return same(row.readiness?.calculation?.state, value);
        case 'recommendation_state': return value === 'any'
          ? ['ready', 'accepted', 'declined'].includes(row.recommendation?.state)
          : same(row.recommendation?.state, value);
        case 'price_group_id': return (row.pricing_inputs?.groups || []).some((g) => same(g.group_id, value));
        case 'area_min_scaled': return Number(row.sellable_area_scaled) >= Number(value);
        case 'area_max_scaled': return Number(row.sellable_area_scaled) <= Number(value);
        case 'price_min_scaled': return row.price?.absolute_scaled != null && Number(row.price.absolute_scaled) >= Number(value);
        case 'price_max_scaled': return row.price?.absolute_scaled != null && Number(row.price.absolute_scaled) <= Number(value);
        default: throw new ApiError('offline_unavailable');
      }
    });
  }
  function orderValue(row, key) {
    const h = row.hierarchy || {};
    const values = {
      unit_number: row.unit_number, phase: h.phase_name, building: h.building_name,
      section: h.section_name, floor: h.floor_number, stack: h.stack_code,
      property_type: row.property_type, rooms: row.rooms_value,
      area: Number(row.sellable_area_scaled), commercial_status: row.commercial?.display_state,
      price: row.price?.absolute_scaled == null ? null : Number(row.price.absolute_scaled),
      manual_control: Number(row.commercial?.manual_control),
    };
    return values[key];
  }
  function paginate(source, options = {}) {
    const result = clone(source);
    const offset = options.offset || 0;
    const limit = options.limit || result.limit || 25;
    result.items = result.items.slice(offset, offset + limit);
    result.total = source.items.length;
    result.count = result.items.length;
    result.offset = offset; result.limit = limit;
    result.has_more = offset + limit < result.total;
    return result;
  }
  async function inventoryProjectUnits(id, options = {}) {
    const result = clone(captured(id, options).units);
    const filters = options.filters || {};
    const sort = options.sort || 'unit_number';
    const direction = options.direction || 'asc';
    let rows = result.items.filter((row) => matches(row, filters));
    rows.sort((a, b) => {
      const left = orderValue(a, sort), right = orderValue(b, sort);
      const cmp = left == null ? (right == null ? 0 : 1) : right == null ? -1
        : typeof left === 'number' ? left - right
          : String(left).localeCompare(String(right), 'ru', { numeric: true });
      return (cmp || Number(a.unit_id) - Number(b.unit_id)) * (direction === 'desc' ? -1 : 1);
    });
    result.total = rows.length;
    const size = options.pageSize || 50, page = options.page || 1;
    result.offset = (page - 1) * size; result.limit = size;
    result.items = rows.slice(result.offset, result.offset + size);
    result.count = result.items.length;
    result.has_more = result.offset + size < result.total;
    result.applied = { ...result.applied, filters, sort, direction, page, page_size: size, limit: size, offset: result.offset };
    result.reconciliation.filtered_units = result.total;
    return result;
  }
  async function inventoryProjectChessboard(id, sectionId, options = {}) {
    const record = captured(id, options);
    const board = clone(record.boards[String(sectionId)]);
    const filters = { ...(options.filters || {}) };
    delete filters.section; delete filters.section_id;
    const ids = new Set(record.units.items.filter((row) => matches(row, filters)).map((row) => row.unit_id));
    let hidden = 0;
    for (const cell of board.cells) {
      if (cell.unit && !ids.has(cell.unit.unit_id)) {
        cell.type = 'filtered_occupied'; cell.unit = null; hidden += 1;
      }
    }
    const visible = new Set(board.cells.filter((c) => c.unit).map((c) => c.unit.unit_id)).size;
    board.counts.visible_units = visible;
    board.counts.filtered_occupied = hidden;
    board.counts.placements -= hidden;
    board.reconciliation.table_filtered_units = visible;
    board.reconciliation.emitted_distinct_units = visible;
    board.applied.filters = filters;
    board.no_matches = visible === 0;
    return board;
  }
  const api = {
    ApiError,
    offlineSession: clone(data.session),
    session: async () => clone(data.session),
    login: unavailable,
    logout: async () => { location.href = '../login/'; },
    onSessionExpired: () => {}, supersedeInflightViews: () => {},
    activeInventory: async () => clone(data.active),
    dataWorkspace: async () => clone(data.workspace),
    importHistory: async (options) => paginate(data.imports, options),
    inventoryVersionHistory: async (options) => paginate(data.versions, options),
    importReview: async (id) => clone(data.reviews[String(id)]),
    operationalSurfaces: async (id, options) => clone(captured(id, options).surfaces),
    inventoryProjectUnits,
    inventoryProjectChessboard,
    inventoryProjectBuildingChessboard: async (id, sections, options) =>
      Promise.all(sections.map((s) => inventoryProjectChessboard(id, s.id ?? s, options))),
    inventoryProjectUnitDetail: async (id, unitId, options = {}) => {
      const detail = clone(captured(id, options).details[String(unitId)]);
      const offset = options.historyOffset || 0, limit = options.historyLimit || 100;
      for (const key of ['price_history', 'commercial_history']) {
        detail.history[key] = detail.history[key].slice(offset, offset + limit);
      }
      detail.history.offset = offset; detail.history.limit = limit;
      return detail;
    },
    listCalculationSnapshots: async (id, options) => paginate(project(id).snapshots, options),
    inspectCalculationSnapshot: async (id, snapshotId, options = {}) => {
      const result = clone(project(id).snapshot_details[String(snapshotId)]);
      const offset = options.resultOffset || 0, limit = options.resultLimit || 25;
      const total = result.results.length;
      result.results = result.results.slice(offset, offset + limit);
      result.result_pagination = { total, count: result.results.length, offset, limit, has_more: offset + limit < total };
      return result;
    },
    myProductFeedback: async () => ({ items: [], total: 0, count: 0, limit: 100, offset: 0, has_more: false }),
  };
  return new Proxy(api, { get: (target, key) => key in target ? target[key] : unavailable });
}
