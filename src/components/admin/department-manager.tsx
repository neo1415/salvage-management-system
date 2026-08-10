'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, Power } from 'lucide-react';

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
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch('/api/admin/departments', { cache: 'no-store' });
    if (response.ok) setDepartments((await response.json()).departments ?? []);
  };
  useEffect(() => { void load(); }, []);

  const createDepartment = async () => {
    if (!name.trim() || selectedClasses.length === 0) return;
    setSaving(true);
    const response = await fetch('/api/admin/departments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind: 'claims', insuranceClasses: selectedClasses }),
    });
    setSaving(false);
    if (response.ok) { setName(''); setSelectedClasses([]); await load(); }
  };

  return (
    <section className="mt-6 border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Building2 className="h-5 w-5 text-gray-600" /><h2 className="text-lg font-semibold">Departments and designations</h2></div>
      <p className="mb-4 text-sm text-gray-600">Map claims departments to insurance classes. Executive designations are protected system entries.</p>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
        <input className="border border-gray-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Department name" />
        <div className="flex flex-wrap gap-2 border border-gray-200 p-2">
          {insuranceClasses.map((item) => <label key={item.value} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={selectedClasses.includes(item.value)} onChange={(event) => setSelectedClasses((current) => event.target.checked ? [...current, item.value] : current.filter((value) => value !== item.value))} />{item.label}</label>)}
        </div>
        <button type="button" onClick={createDepartment} disabled={saving || !name.trim() || selectedClasses.length === 0} className="inline-flex items-center justify-center gap-2 bg-red-900 px-4 py-2 text-white disabled:opacity-50"><Plus className="h-4 w-4" />Add</button>
      </div>
      <div className="mt-4 divide-y border border-gray-200">
        {departments.map((department) => <div key={department.id} className="flex items-center justify-between gap-4 p-3"><div><p className="font-medium">{department.name}</p><p className="text-xs text-gray-500">{department.kind === 'executive' ? 'Executive designation' : department.insuranceClasses.join(', ')}</p></div>{!department.isSystem && <button type="button" title="Disable department" onClick={async () => { await fetch('/api/admin/departments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: department.id, isActive: false }) }); await load(); }} className="p-2 text-gray-500 hover:text-red-700"><Power className="h-4 w-4" /></button>}</div>)}
      </div>
    </section>
  );
}

