import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Content,
  DataTable,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Form,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderName,
  InlineNotification,
  Modal,
  PasswordInput,
  SkipToContent,
  Stack,
  Table,
  TableBatchAction,
  TableBatchActions,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextArea,
  TextInput,
  Tile,
  ToastNotification,
} from '@carbon/react';
import {
  ArrowRight,
  Download,
  Launch,
  TrashCan,
  UserAvatar,
  View,
} from '@carbon/icons-react';

const STORAGE_KEY = 'seller-weekly-updates';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

const benefitTiles = [
  {
    icon: Launch,
    accent: 'blue',
    heading: 'Quick weekly check-ins',
    body: 'Share your account status in under two minutes—no meetings, no slide decks.',
  },
  {
    icon: View,
    accent: 'teal',
    heading: 'Clear leadership visibility',
    body: 'Every submission lands in one shared dashboard so managers see progress at a glance.',
  },
  {
    icon: ArrowRight,
    accent: 'purple',
    heading: 'Consistent cadence',
    body: 'A simple rhythm keeps deals, risks, and next steps aligned across the team.',
  },
];

const initialFormState = {
  sellerName: '',
  accountName: '',
  weeklyUpdate: '',
  nextSteps: '',
};

const formatTimestamp = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (err) {
    return iso;
  }
};

const formatDateOnly = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (err) {
    return iso;
  }
};

const loadSubmissions = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const saveSubmissions = (list) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    /* storage full or unavailable; ignore */
  }
};

const csvEscape = (value) => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const exportCsv = (rows) => {
  const headers = [
    'Submitted',
    'Seller',
    'Account',
    'Weekly update',
    'Next steps',
  ];
  const body = rows.map((r) =>
    [
      new Date(r.submittedAt).toISOString(),
      r.sellerName,
      r.accountName,
      r.weeklyUpdate,
      r.nextSteps,
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `seller-updates-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function App() {
  const [view, setView] = useState('seller');
  const [submissions, setSubmissions] = useState(() => loadSubmissions());
  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(null);

  const [selectedRowId, setSelectedRowId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [sellerFilter, setSellerFilter] = useState(null);
  const [accountFilter, setAccountFilter] = useState(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(null);

  useEffect(() => {
    saveSubmissions(submissions);
  }, [submissions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const next = {};
    if (!form.sellerName.trim()) next.sellerName = 'Enter your name.';
    if (!form.accountName.trim()) next.accountName = 'Enter the account name.';
    if (!form.weeklyUpdate.trim())
      next.weeklyUpdate = 'Share a short update for the week.';
    if (!form.nextSteps.trim())
      next.nextSteps = 'List at least one next step.';
    return next;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const entry = {
      id: `update-${Date.now()}`,
      sellerName: form.sellerName.trim(),
      accountName: form.accountName.trim(),
      weeklyUpdate: form.weeklyUpdate.trim(),
      nextSteps: form.nextSteps.trim(),
      submittedAt: new Date().toISOString(),
    };
    setSubmissions((prev) => [entry, ...prev]);
    setForm(initialFormState);
    setErrors({});
    setToast({
      kind: 'success',
      title: 'Update submitted',
      subtitle: `Thanks, ${entry.sellerName}. Your update for ${entry.accountName} was recorded.`,
    });
  };

  const openLogin = () => {
    setLoginForm({ username: '', password: '' });
    setLoginError(null);
    setLoginOpen(true);
  };

  const handleLogin = () => {
    if (
      loginForm.username.trim() === ADMIN_USERNAME &&
      loginForm.password === ADMIN_PASSWORD
    ) {
      setLoginOpen(false);
      setView('admin');
      setLoginError(null);
    } else {
      setLoginError('Incorrect username or password. Try again.');
    }
  };

  const handleLogout = () => {
    setView('seller');
    setSelectedRowId(null);
    setSearchTerm('');
    setDateRange([null, null]);
    setSellerFilter(null);
    setAccountFilter(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateRange([null, null]);
    setSellerFilter(null);
    setAccountFilter(null);
  };

  const requestDelete = (ids) => {
    if (!ids || ids.length === 0) return;
    setPendingDeleteIds(ids);
  };

  const confirmDelete = () => {
    const ids = pendingDeleteIds ?? [];
    if (ids.length === 0) {
      setPendingDeleteIds(null);
      return;
    }
    const idSet = new Set(ids);
    setSubmissions((prev) => prev.filter((s) => !idSet.has(s.id)));
    if (selectedRowId && idSet.has(selectedRowId)) {
      setSelectedRowId(null);
    }
    setPendingDeleteIds(null);
    setToast({
      kind: 'success',
      title: ids.length === 1 ? 'Update deleted' : 'Updates deleted',
      subtitle:
        ids.length === 1
          ? 'The selected submission was removed.'
          : `${ids.length} submissions were removed.`,
    });
  };

  const applyPreset = (preset) => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (preset === 'today') {
      setDateRange([new Date(start), new Date(end)]);
    } else if (preset === 'this-week') {
      const day = start.getDay();
      const diffToMonday = (day + 6) % 7;
      start.setDate(start.getDate() - diffToMonday);
      setDateRange([new Date(start), new Date(end)]);
    } else if (preset === 'last-7') {
      start.setDate(start.getDate() - 6);
      setDateRange([new Date(start), new Date(end)]);
    } else if (preset === 'last-30') {
      start.setDate(start.getDate() - 29);
      setDateRange([new Date(start), new Date(end)]);
    } else if (preset === 'this-month') {
      start.setDate(1);
      setDateRange([new Date(start), new Date(end)]);
    } else if (preset === 'all') {
      setDateRange([null, null]);
    }
  };

  const uniqueSellers = useMemo(() => {
    const set = new Set(submissions.map((s) => s.sellerName));
    return ['All sellers', ...Array.from(set).sort()];
  }, [submissions]);

  const uniqueAccounts = useMemo(() => {
    const set = new Set(submissions.map((s) => s.accountName));
    return ['All accounts', ...Array.from(set).sort()];
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const [from, to] = dateRange;
    const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : null;
    const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : null;
    return submissions.filter((item) => {
      if (term) {
        const haystack = [
          item.sellerName,
          item.accountName,
          item.weeklyUpdate,
          item.nextSteps,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (sellerFilter && sellerFilter !== 'All sellers' &&
          item.sellerName !== sellerFilter) {
        return false;
      }
      if (accountFilter && accountFilter !== 'All accounts' &&
          item.accountName !== accountFilter) {
        return false;
      }
      if (fromMs || toMs) {
        const ts = new Date(item.submittedAt).getTime();
        if (fromMs && ts < fromMs) return false;
        if (toMs && ts > toMs) return false;
      }
      return true;
    });
  }, [submissions, searchTerm, dateRange, sellerFilter, accountFilter]);

  const tableHeaders = [
    { key: 'submittedAt', header: 'Submitted' },
    { key: 'sellerName', header: 'Seller' },
    { key: 'accountName', header: 'Account' },
    { key: 'summary', header: 'Update summary' },
  ];

  const tableRows = useMemo(
    () =>
      filteredSubmissions.map((item) => ({
        id: item.id,
        submittedAt: formatDateOnly(item.submittedAt),
        sellerName: item.sellerName,
        accountName: item.accountName,
        summary:
          item.weeklyUpdate.length > 80
            ? `${item.weeklyUpdate.slice(0, 80)}…`
            : item.weeklyUpdate,
      })),
    [filteredSubmissions]
  );

  const selected = useMemo(
    () => submissions.find((item) => item.id === selectedRowId) || null,
    [submissions, selectedRowId]
  );

  const renderHeader = () => (
    <Header aria-label="Weekly Seller Updates">
      <SkipToContent />
      <HeaderName href="#" prefix="CIC">
        Weekly Seller Updates
      </HeaderName>
      <HeaderGlobalBar>
        {view === 'admin' ? (
          <HeaderGlobalAction
            aria-label="Sign out of admin"
            tooltipAlignment="end"
            onClick={handleLogout}
          >
            <UserAvatar size={20} />
          </HeaderGlobalAction>
        ) : (
          <HeaderGlobalAction
            aria-label="Open admin sign in"
            tooltipAlignment="end"
            onClick={openLogin}
          >
            <UserAvatar size={20} />
          </HeaderGlobalAction>
        )}
      </HeaderGlobalBar>
    </Header>
  );

  return (
    <>
      <HeaderContainer render={renderHeader} />
      <Content>
        <main id="main-content" className="app-main">
          {view === 'seller' ? (
            <SellerView
              form={form}
              errors={errors}
              updateField={updateField}
              onSubmit={handleSubmit}
            />
          ) : (
            <AdminView
              submissions={submissions}
              filteredSubmissions={filteredSubmissions}
              tableHeaders={tableHeaders}
              tableRows={tableRows}
              selected={selected}
              setSelectedRowId={setSelectedRowId}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              dateRange={dateRange}
              setDateRange={setDateRange}
              sellerFilter={sellerFilter}
              setSellerFilter={setSellerFilter}
              accountFilter={accountFilter}
              setAccountFilter={setAccountFilter}
              uniqueSellers={uniqueSellers}
              uniqueAccounts={uniqueAccounts}
              applyPreset={applyPreset}
              clearFilters={clearFilters}
              onLogout={handleLogout}
              onRequestDelete={requestDelete}
            />
          )}
        </main>
      </Content>

      <Modal
        open={loginOpen}
        modalHeading="Admin sign in"
        modalLabel="Internal tool"
        primaryButtonText="Sign in"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleLogin}
        onRequestClose={() => setLoginOpen(false)}
      >
        <Stack gap={5}>
          <p>Enter the admin credentials to view submitted updates.</p>
          {loginError && (
            <InlineNotification
              kind="error"
              title="Sign-in failed"
              subtitle={loginError}
              lowContrast
              hideCloseButton
            />
          )}
          <TextInput
            id="admin-username"
            labelText="Username"
            data-modal-primary-focus
            value={loginForm.username}
            onChange={(e) =>
              setLoginForm((prev) => ({ ...prev, username: e.target.value }))
            }
          />
          <PasswordInput
            id="admin-password"
            labelText="Password"
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm((prev) => ({ ...prev, password: e.target.value }))
            }
          />
          <div className="credentials-hint">
            <p className="credentials-hint__label cds--label">Sample credentials</p>
            <p>
              Username: <code>admin</code>
              {'  '}·{'  '}Password: <code>admin123</code>
            </p>
          </div>
        </Stack>
      </Modal>

      <Modal
        open={pendingDeleteIds !== null}
        danger
        modalHeading={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} updates?`
            : 'Delete this update?'
        }
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestSubmit={confirmDelete}
        onRequestClose={() => setPendingDeleteIds(null)}
      >
        <p>
          This permanently removes the submission
          {pendingDeleteIds && pendingDeleteIds.length > 1 ? 's' : ''} from the
          dashboard. This action cannot be undone.
        </p>
      </Modal>

      {toast && (
        <div className="notification-region" role="status" aria-live="polite">
          <ToastNotification
            kind={toast.kind}
            title={toast.title}
            subtitle={toast.subtitle}
            timeout={0}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </>
  );
}

function SellerView({ form, errors, updateField, onSubmit }) {
  return (
    <>
      <section className="page-hero" aria-labelledby="page-title">
        <h1 id="page-title" className="cds--type-expressive-heading-04 page-title">
          Share this week&rsquo;s account update
        </h1>
        <p className="cds--type-body-long-02 page-subtitle">
          One quick form keeps your team aligned on progress, blockers, and
          what&rsquo;s next across every account you own.
        </p>
      </section>

      <section aria-labelledby="benefits-heading">
        <h2
          id="benefits-heading"
          className="cds--type-productive-heading-03 section-heading"
        >
          Why submit a weekly update
        </h2>
        <div className="tiles-grid">
          {benefitTiles.map(({ icon: Icon, accent, heading, body }) => (
            <Tile
              key={heading}
              className={`benefit-tile benefit-tile--accent-${accent}`}
            >
              <div className="benefit-tile__icon" aria-hidden="true">
                <Icon size={24} />
              </div>
              <h3 className="cds--type-productive-heading-02 benefit-tile__heading">
                {heading}
              </h3>
              <p className="cds--type-body-long-01 benefit-tile__body">{body}</p>
            </Tile>
          ))}
        </div>
      </section>

      <section aria-labelledby="form-heading" className="form-card">
        <div className="form-card__header">
          <h2
            id="form-heading"
            className="cds--type-productive-heading-03 form-card__title"
          >
            Your update
          </h2>
          <p className="cds--type-body-long-01 form-card__description">
            All fields are required. Your update will reach the admin dashboard
            the moment you submit.
          </p>
        </div>
        <Form aria-labelledby="form-heading" onSubmit={onSubmit} noValidate>
          <Stack gap={6}>
            <TextInput
              id="seller-name"
              labelText="Your name"
              placeholder="e.g. Jordan Chen"
              value={form.sellerName}
              onChange={updateField('sellerName')}
              invalid={Boolean(errors.sellerName)}
              invalidText={errors.sellerName}
              required
              autoComplete="name"
            />
            <TextInput
              id="account-name"
              labelText="Account name"
              placeholder="e.g. Northwind Logistics"
              value={form.accountName}
              onChange={updateField('accountName')}
              invalid={Boolean(errors.accountName)}
              invalidText={errors.accountName}
              required
            />
            <TextArea
              id="weekly-update"
              labelText="Update for the week"
              helperText="What moved forward, what slowed down, and any risks worth flagging."
              rows={5}
              value={form.weeklyUpdate}
              onChange={updateField('weeklyUpdate')}
              invalid={Boolean(errors.weeklyUpdate)}
              invalidText={errors.weeklyUpdate}
              required
            />
            <TextArea
              id="next-steps"
              labelText="Next steps"
              helperText="List the concrete actions planned for next week."
              rows={4}
              value={form.nextSteps}
              onChange={updateField('nextSteps')}
              invalid={Boolean(errors.nextSteps)}
              invalidText={errors.nextSteps}
              required
            />
            <div className="form-actions">
              <Button type="submit" kind="primary" renderIcon={ArrowRight}>
                Submit update
              </Button>
            </div>
          </Stack>
        </Form>
      </section>
    </>
  );
}

function AdminView({
  submissions,
  filteredSubmissions,
  tableHeaders,
  tableRows,
  selected,
  setSelectedRowId,
  searchTerm,
  setSearchTerm,
  dateRange,
  setDateRange,
  sellerFilter,
  setSellerFilter,
  accountFilter,
  setAccountFilter,
  uniqueSellers,
  uniqueAccounts,
  applyPreset,
  clearFilters,
  onLogout,
  onRequestDelete,
}) {
  const hasData = submissions.length > 0;
  const hasActiveFilters =
    Boolean(searchTerm) ||
    Boolean(dateRange[0]) ||
    Boolean(dateRange[1]) ||
    (sellerFilter && sellerFilter !== 'All sellers') ||
    (accountFilter && accountFilter !== 'All accounts');

  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'this-week', label: 'This week' },
    { id: 'last-7', label: 'Last 7 days' },
    { id: 'this-month', label: 'This month' },
    { id: 'last-30', label: 'Last 30 days' },
    { id: 'all', label: 'All time' },
  ];

  return (
    <section className="admin-section" aria-labelledby="admin-heading">
      <div className="admin-heading-row">
        <div>
          <h1
            id="admin-heading"
            className="cds--type-expressive-heading-04 page-title"
          >
            Admin dashboard
          </h1>
          <p className="admin-meta cds--type-body-long-01">
            Showing {filteredSubmissions.length} of {submissions.length}{' '}
            submission{submissions.length === 1 ? '' : 's'} · signed in as admin
          </p>
        </div>
        <div className="admin-heading-actions">
          <Button
            kind="tertiary"
            onClick={() => exportCsv(filteredSubmissions)}
            renderIcon={Download}
            disabled={filteredSubmissions.length === 0}
          >
            Export CSV
          </Button>
          <Button kind="ghost" onClick={onLogout} renderIcon={ArrowRight}>
            Return to seller form
          </Button>
        </div>
      </div>

      {hasData && (
        <div className="filter-panel" role="region" aria-label="Filters">
          <div className="filter-panel__row">
            <DatePicker
              datePickerType="range"
              dateFormat="m/d/Y"
              value={dateRange}
              onChange={(dates) =>
                setDateRange([dates[0] || null, dates[1] || null])
              }
            >
              <DatePickerInput
                id="date-from"
                placeholder="mm/dd/yyyy"
                labelText="From"
                size="md"
              />
              <DatePickerInput
                id="date-to"
                placeholder="mm/dd/yyyy"
                labelText="To"
                size="md"
              />
            </DatePicker>
            <Dropdown
              id="seller-filter"
              titleText="Seller"
              label="All sellers"
              items={uniqueSellers}
              selectedItem={sellerFilter ?? 'All sellers'}
              onChange={({ selectedItem }) => setSellerFilter(selectedItem)}
              size="md"
            />
            <Dropdown
              id="account-filter"
              titleText="Account"
              label="All accounts"
              items={uniqueAccounts}
              selectedItem={accountFilter ?? 'All accounts'}
              onChange={({ selectedItem }) => setAccountFilter(selectedItem)}
              size="md"
            />
          </div>
          <div className="filter-panel__presets" role="group" aria-label="Quick date ranges">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                kind="ghost"
                size="sm"
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              kind="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Clear filters
            </Button>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="empty-state">
          <h2 className="cds--type-productive-heading-03 empty-state__heading">
            No updates yet
          </h2>
          <p className="cds--type-body-long-01 empty-state__body">
            Once sellers submit their weekly updates, you&rsquo;ll see every
            entry here with date, seller, and account.
          </p>
        </div>
      ) : (
        <DataTable
          rows={tableRows}
          headers={tableHeaders}
          isSortable
          useZebraStyles={false}
        >
          {({
            rows,
            headers,
            getHeaderProps,
            getRowProps,
            getSelectionProps,
            getBatchActionProps,
            getTableProps,
            getTableContainerProps,
            getToolbarProps,
            selectedRows,
          }) => {
            const batchActionProps = getBatchActionProps();
            return (
              <TableContainer
                title="Weekly updates"
                description="Select a row to read the full update, or check rows to delete."
                {...getTableContainerProps()}
              >
                <TableToolbar {...getToolbarProps()}>
                  <TableBatchActions {...batchActionProps}>
                    <TableBatchAction
                      tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                      renderIcon={TrashCan}
                      onClick={() =>
                        onRequestDelete(selectedRows.map((r) => r.id))
                      }
                    >
                      Delete
                    </TableBatchAction>
                  </TableBatchActions>
                  <TableToolbarContent
                    aria-hidden={batchActionProps.shouldShowBatchActions}
                  >
                    <TableToolbarSearch
                      persistent
                      value={searchTerm}
                      onChange={(evt) => setSearchTerm(evt.target.value)}
                      labelText="Search updates"
                      placeholder="Search seller, account, or text"
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()} aria-label="Submitted weekly updates">
                  <TableHead>
                    <TableRow>
                      <TableSelectAll {...getSelectionProps()} />
                      {headers.map((header) => (
                        <TableHeader
                          key={header.key}
                          {...getHeaderProps({ header })}
                        >
                          {header.header}
                        </TableHeader>
                      ))}
                      <TableHeader aria-label="Row actions" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const rowProps = getRowProps({ row });
                      const selectionProps = getSelectionProps({ row });
                      const isSelected = row.id === selected?.id;
                      return (
                        <TableRow
                          {...rowProps}
                          onClick={() => setSelectedRowId(row.id)}
                          style={{ cursor: 'pointer' }}
                          aria-selected={isSelected}
                        >
                          <TableSelectRow
                            {...selectionProps}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectionProps.onClick?.(e);
                            }}
                          />
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'submittedAt' ? (
                                <Tag type="cool-gray">{cell.value}</Tag>
                              ) : (
                                cell.value
                              )}
                            </TableCell>
                          ))}
                          <TableCell
                            className="row-delete-cell"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              kind="danger--ghost"
                              size="sm"
                              renderIcon={TrashCan}
                              hasIconOnly
                              iconDescription="Delete update"
                              tooltipPosition="left"
                              onClick={() => onRequestDelete([row.id])}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredSubmissions.length === 0 && (
                  <div className="empty-state">
                    <h2 className="cds--type-productive-heading-03 empty-state__heading">
                      No matches
                    </h2>
                    <p className="cds--type-body-long-01 empty-state__body">
                      Try a different seller, account, or keyword.
                    </p>
                  </div>
                )}
              </TableContainer>
            );
          }}
        </DataTable>
      )}

      {selected && (
        <article className="detail-panel" aria-labelledby="detail-title">
          <h2
            id="detail-title"
            className="cds--type-productive-heading-03 detail-panel__title"
          >
            {selected.accountName}
          </h2>
          <p className="detail-panel__meta cds--type-body-long-01">
            Submitted by {selected.sellerName} ·{' '}
            {formatTimestamp(selected.submittedAt)}
          </p>

          <p className="cds--label detail-panel__label">Update for the week</p>
          <p className="cds--type-body-long-02 detail-panel__text">
            {selected.weeklyUpdate}
          </p>

          <p className="cds--label detail-panel__label">Next steps</p>
          <p className="cds--type-body-long-02 detail-panel__text">
            {selected.nextSteps}
          </p>
        </article>
      )}
    </section>
  );
}
