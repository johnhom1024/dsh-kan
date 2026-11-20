window.__ModuleLoader__.load({
  id: 'dsh-kan',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const API = '/plugins/dsh-kan/api'

    const STRINGS = {
      en: {
        title: 'Kan',
        refresh: 'Refresh',
        back: 'Back',
        workspaces: 'Workspaces',
        boards: 'Boards',
        noWorkspaces: 'No workspaces yet.',
        noBoards: 'This workspace has no boards yet. If you expected boards, check your access to the workspace.',
        noCards: 'No cards in this list.',
        loading: 'Loading…',
        retry: 'Retry',
        labels: 'Labels',
        assignees: 'Assignees',
        due: 'Due',
        emptyDetail: 'This card has no description.',
        failed: 'Could not load Kan data.',
      },
      zh: {
        title: 'Kan',
        refresh: '刷新',
        back: '返回',
        workspaces: '工作区',
        boards: '看板',
        noWorkspaces: '还没有工作区。',
        noBoards: '这个工作区还没有看板。如果你预期有看板，请检查你在该工作区的权限。',
        noCards: '这个列表里没有卡片。',
        loading: '加载中…',
        retry: '重试',
        labels: '标签',
        assignees: '负责人',
        due: '截止',
        emptyDetail: '这张卡片没有描述。',
        failed: '无法加载 Kan 数据。',
      },
    }


    const S = {
      page: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        color: 'var(--dsw-alias-label-primary, inherit)',
        background: 'var(--dsw-alias-bg-base, transparent)',
        font: 'inherit',
      },
      header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))',
        flex: '0 0 auto',
      },
      h1: { margin: 0, fontSize: '15px', fontWeight: 600, flex: '1 1 auto' },
      btn: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))',
        background: 'transparent',
        color: 'inherit',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '12px',
        cursor: 'pointer',
      },
      body: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '12px 14px' },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        marginBottom: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '13px',
      },
      columns: { display: 'flex', gap: '12px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '8px' },
      column: {
        flex: '0 0 260px',
        maxWidth: '260px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))',
        borderRadius: '8px',
        padding: '10px',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
      },
      columnTitle: { margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-secondary, inherit)' },
      card: {
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        marginBottom: '6px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22))',
        borderRadius: '6px',
        background: 'var(--dsw-alias-bg-base, transparent)',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '13px',
      },
      muted: { color: 'var(--dsw-alias-label-secondary, inherit)', fontSize: '12px' },
      chip: {
        display: 'inline-block',
        padding: '1px 8px',
        marginRight: '6px',
        borderRadius: '999px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))',
        fontSize: '11px',
      },
      err: {
        padding: '10px 12px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-static-red-600, #b4321f)',
        color: 'var(--dsw-static-red-600, #b4321f)',
        fontSize: '12px',
      },
      pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', lineHeight: 1.5, margin: '8px 0 0' },
    }

    const OP_KEYS = { workspaces: 'workspaces', boards: 'boards', board: 'board', card: 'card' }

    function responseError(code, status) {
      const error = new Error(`Kan response rejected (${code})`)
      error.code = code
      if (status !== undefined) error.status = status
      return error
    }

    // Strict response contract: a 200 reply must be JSON, an object, and carry the
    // array/object the requested op declares. Only an empty array is an empty state.
    async function parseResponse(res, op) {
      const text = await res.text()
      let body
      try {
        body = text === '' ? null : JSON.parse(text)
      } catch {
        throw responseError('invalid-json', res.status)
      }
      const key = OP_KEYS[op]
      if (!res.ok) {
        const code = body && typeof body === 'object' && typeof body.error === 'string' ? body.error : `http-${res.status}`
        throw responseError(code, res.status)
      }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw responseError('invalid-body', res.status)
      if (key === undefined) throw responseError('unknown-op', res.status)
      const value = body[key]
      if (op === 'board' || op === 'card') {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) throw responseError(`missing-${key}`, res.status)
      } else if (!Array.isArray(value)) {
        throw responseError(`missing-${key}`, res.status)
      }
      return body
    }

    async function request(op, params, signal) {
      const qs = new URLSearchParams(Object.assign({ op }, params || {}))
      const res = await fetch(`${API}?${qs.toString()}`, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal,
      })
      return parseResponse(res, op)
    }

    function ListRow(props) {
      return h('button', { type: 'button', style: S.row, onClick: props.onClick }, props.label)
    }

    function CardChip(props) {
      return h('span', { style: S.chip }, props.label)
    }

    function KanPage(props) {
      const t = props.t
      const [node, setNode] = React.useState({ kind: 'workspaces' })
      const [history, setHistory] = React.useState([])
      const [data, setData] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const tokenRef = React.useRef(0)
      const abortRef = React.useRef(null)

      const load = React.useCallback(
        async target => {
          if (abortRef.current) abortRef.current.abort()
          const controller = typeof AbortController === 'function' ? new AbortController() : null
          abortRef.current = controller
          const token = ++tokenRef.current
          setLoading(true)
          setError(null)
          try {
            let body
            if (target.kind === 'workspaces') body = await request('workspaces', {}, controller?.signal)
            else if (target.kind === 'boards') body = await request('boards', { workspaceId: target.id }, controller?.signal)
            else if (target.kind === 'board') body = await request('board', { boardId: target.id }, controller?.signal)
            else body = await request('card', { cardId: target.id }, controller?.signal)
            if (token !== tokenRef.current) return
            setData(body)
          } catch (err) {
            if (token !== tokenRef.current) return
            if (err && err.name === 'AbortError') return
            setError(err?.message || t('failed'))
          } finally {
            if (token === tokenRef.current) setLoading(false)
          }
        },
        [t],
      )

      React.useEffect(() => {
        load({ kind: 'workspaces' })
        return () => {
          if (abortRef.current) abortRef.current.abort()
          tokenRef.current += 1
        }
      }, [load])

      const go = next => {
        setHistory(prev => [...prev, node])
        setNode(next)
        setData(null)
        load(next)
      }
      const back = () => {
        setHistory(prev => {
          if (prev.length === 0) return prev
          const previous = prev[prev.length - 1]
          setNode(previous)
          setData(null)
          load(previous)
          return prev.slice(0, -1)
        })
      }

      const header = h(
        'div',
        { style: S.header },
        history.length > 0 ? h('button', { type: 'button', style: S.btn, onClick: back }, `‹ ${t('back')}`) : null,
        h('h1', { style: S.h1 }, t('title')),
        h('button', { type: 'button', style: S.btn, onClick: () => load(node), disabled: loading }, t('refresh')),
      )

      let content
      if (loading && data === null) {
        content = h('div', { style: S.muted }, t('loading'))
      } else if (error) {
        content = h(
          'div',
          null,
          h('div', { style: S.err }, `${t('failed')} ${error}`),
          h('button', { type: 'button', style: Object.assign({}, S.btn, { marginTop: '10px' }), onClick: () => load(node) }, t('retry')),
        )
      } else if (node.kind === 'workspaces') {
        const workspaces = data?.workspaces || []
        content =
          workspaces.length === 0
            ? h('div', { style: S.muted }, t('noWorkspaces'))
            : workspaces.map(workspace =>
                h(ListRow, {
                  key: workspace.id || workspace.name,
                  label: workspace.name || workspace.id,
                  onClick: () => go({ kind: 'boards', id: workspace.id, name: workspace.name }),
                }),
              )
      } else if (node.kind === 'boards') {
        const boards = data?.boards || []
        content =
          boards.length === 0
            ? h('div', { style: S.muted }, t('noBoards'))
            : boards.map(board =>
                h(ListRow, {
                  key: board.id || board.name,
                  label: board.name || board.id,
                  onClick: () => go({ kind: 'board', id: board.id, name: board.name }),
                }),
              )
      } else if (node.kind === 'board') {
        const lists = data?.board?.lists || []
        content =
          lists.length === 0
            ? h('div', { style: S.muted }, t('noCards'))
            : h(
                'div',
                { style: S.columns },
                lists.map(list =>
                  h(
                    'div',
                    { key: list.id || list.name, style: S.column },
                    h('p', { style: S.columnTitle }, list.name || list.id),
                    (list.cards || []).length === 0
                      ? h('div', { style: S.muted }, t('noCards'))
                      : list.cards.map(card =>
                          h(
                            'button',
                            {
                              key: card.id || card.title,
                              type: 'button',
                              style: S.card,
                              onClick: () => go({ kind: 'card', id: card.id, name: card.title }),
                            },
                            card.title || card.id,
                          ),
                        ),
                  ),
                ),
              )
      } else {
        const card = data?.card || {}
        content = h(
          'div',
          null,
          h('h2', { style: { margin: '0 0 6px', fontSize: '16px' } }, card.title || node.name || node.id),
          (card.labels || []).length > 0
            ? h('div', { style: { margin: '8px 0' } }, card.labels.map((label, index) => h(CardChip, { key: index, label })))
            : null,
          (card.assignees || []).length > 0
            ? h('p', { style: S.muted }, `${t('assignees')}: ${card.assignees.join(', ')}`)
            : null,
          card.dueDate ? h('p', { style: S.muted }, `${t('due')}: ${card.dueDate}`) : null,
          h('pre', { style: S.pre }, card.description || t('emptyDetail')),
        )
      }

      return h('div', { style: S.page }, header, h('div', { style: S.body }, content))
    }

    return {
      inject: ['slots', 'layout', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-kan', { en: STRINGS.en, zh: STRINGS.zh }), 'dsh-kan: locale')
        const t = ctx.locale.bind('dsh-kan')

        const Entry = () =>
          h(
            'button',
            {
              type: 'button',
              title: t('title'),
              'aria-label': t('title'),
              style: {
                width: '28px',
                height: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                borderRadius: '6px',
              },
              onClick: () => ctx.layout.selectPanel('kan'),
            },
            h(
              'svg',
              { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true },
              h('rect', { x: 3, y: 4, width: 5, height: 16, rx: 1, fill: 'currentColor', opacity: 0.85 }),
              h('rect', { x: 9.5, y: 4, width: 5, height: 11, rx: 1, fill: 'currentColor', opacity: 0.6 }),
              h('rect', { x: 16, y: 4, width: 5, height: 7, rx: 1, fill: 'currentColor', opacity: 0.4 }),
            ),
          )

        const Page = () => h(KanPage, { ctx, t })

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: 'kan', order: 40, label: t('title') }, Entry),
        )
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'kan' }, Page))
      },
      // The response contract is tested directly from this module, so the test and
      // production share one implementation.
      __test: { parseResponse },
    }
  },
})
