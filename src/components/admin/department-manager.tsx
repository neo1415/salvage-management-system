'use client';

import { useEffect, useState } from 'react';
import { Building2, Loader2, Plus, Power } from 'lucide-react';
import { normalizeInsuranceClassLabel } from '@/features/business-policy/insurance-class-options';

type Department = {
  id: string;
  code: string;
  name: string;
  kind: 'executive' | 'claims' | 'support';
  insuranceClasses: string[];
  isSystem: boolean;
};

type Props = { insuranceClasses: Array<{ value: string; label: string }> };

export function DepartmentManager({ insuranceClasses }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [otherClass, setOtherClass] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch('/api/admin/departments', { cache: 'no-store' });
    if (response.ok) setDepartments((await response.json()).departments ?? []);
  };
  useEffect(() => { void load(); }, []);

  const createDepartment = async () => {
    if (saving) return;
    const customClass = normalizeInsuranceClassLabel(otherClass);
    const resolvedClasses = selectedClasses
      .filter((value) => value !== 'other')
      .concat(selectedClasses.includes('other') && customClass ? [customClass] : []);
    const uniqueClasses = Array.from(new Map(resolvedClasses.map((value) => [value.toLowerCase(), value])).values());

    if (!name.trim() || uniqueClasses.length === 0) {
      setError(selectedClasses.includes('other') && !customClass
        ? 'Enter the insurance class represented by Other.'
        : 'Enter a department name and select at least one insurance class.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/departments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), kind: 'claims', insuranceClasses: uniqueClasses }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Department could not be added.');
      setName('');
      setSelectedClasses([]);
      setOtherClass('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Department could not be added.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Building2 className="h-5 w-5 text-gray-600" /><h2 className="text-lg font-semibold">Departments and designations</h2></div>
      <p className="mb-4 text-sm text-gray-600">Map claims departments to insurance classes. Executive designations are protected system entries.</p>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
        <input className="border border-gray-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Department name" />
        <div className="flex flex-wrap items-center gap-2 border border-gray-200 p-2">
          {insuranceClasses.map((item) => <label key={item.value} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={selectedClasses.includes(item.value)} onChange={(event) => setSelectedClasses((current) => event.target.checked ? [...current, item.value] : current.filter((value) => value !== item.value))} />{item.label}</label>)}
          {selectedClasses.includes('other') ? (
            <input
              aria-label="Other insurance class"
              autoFocus
              maxLength={120}
              value={otherClass}
              onChange={(event) => setOtherClass(event.target.value)}
              placeholder="Type insurance class"
              className="min-w-52 flex-1 border border-gray-300 px-3 py-2 text-sm"
            />
          ) : null}
        </div>
        <button type="button" onClick={createDepartment} disabled={saving || !name.trim() || selectedClasses.length === 0 || (selectedClasses.includes('other') && !otherClass.trim())} className="inline-flex min-w-28 items-center justify-center gap-2 bg-red-900 px-4 py-2 text-white disabled:opacity-50" aria-busy={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{saving ? 'Adding...' : 'Add'}</button>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 divide-y border border-gray-200">
        {departments.map((department) => <div key={department.id} className="flex items-center justify-between gap-4 p-3"><div><p className="font-medium">{department.name}</p><p className="text-xs text-gray-500">{department.kind === 'executive' ? 'Executive designation' : department.insuranceClasses.join(', ')}</p></div>{!department.isSystem && <button type="button" title="Disable department" onClick={async () => { await fetch('/api/admin/departments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: department.id, isActive: false }) }); await load(); }} className="p-2 text-gray-500 hover:text-red-700"><Power className="h-4 w-4" /></button>}</div>)}
      </div>
    </section>
  );
}
