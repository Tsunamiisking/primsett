'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatNaira } from '@primsett/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Service {
  id: string;
  name: string;
  description: string | null;
  basePriceKobo: number;
  durationMinutes: number;
  requiresDeposit: boolean;
  depositType: 'fixed' | 'percentage';
  depositValue: number;
  isActive: boolean;
}

type ServiceForm = {
  name: string;
  description: string;
  basePriceNaira: string;
  durationMinutes: string;
  requiresDeposit: boolean;
  depositType: 'fixed' | 'percentage';
  depositPercent: string;
  depositNaira: string;
};

const emptyForm = (): ServiceForm => ({
  name: '',
  description: '',
  basePriceNaira: '',
  durationMinutes: '60',
  requiresDeposit: true,
  depositType: 'percentage',
  depositPercent: '30',
  depositNaira: '',
});

function serviceToForm(s: Service): ServiceForm {
  return {
    name: s.name,
    description: s.description ?? '',
    basePriceNaira: String(s.basePriceKobo / 100),
    durationMinutes: String(s.durationMinutes),
    requiresDeposit: s.requiresDeposit,
    depositType: s.depositType,
    depositPercent: s.depositType === 'percentage' ? String(s.depositValue / 100) : '30',
    depositNaira: s.depositType === 'fixed' ? String(s.depositValue / 100) : '',
  };
}

function formToPayload(form: ServiceForm) {
  const basePriceKobo = Math.round(parseFloat(form.basePriceNaira) * 100);
  const depositValue = form.depositType === 'percentage'
    ? Math.round(parseFloat(form.depositPercent) * 100)
    : Math.round(parseFloat(form.depositNaira) * 100);
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    basePriceKobo,
    durationMinutes: parseInt(form.durationMinutes),
    requiresDeposit: form.requiresDeposit,
    depositType: form.depositType,
    depositValue: form.requiresDeposit ? depositValue : 0,
  };
}

export default function ServicesPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm());
  const [error, setError] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['my-services'],
    queryFn: async () => {
      const token = await getToken();
      return api.get<{ success: boolean; data: Service[] }>('/api/v1/vendors/me/services', token ?? undefined);
    },
  });

  const services = res?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const payload = formToPayload(form);
      if (editingId === 'new') {
        return api.post('/api/v1/vendors/me/services', payload, token ?? undefined);
      }
      return api.patch(`/api/v1/vendors/me/services/${editingId}`, payload, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
      setEditingId(null);
      setError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Failed to save';
      setError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.delete(`/api/v1/vendors/me/services/${id}`, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-services'] });
    },
  });

  function openNew() {
    setForm(emptyForm());
    setEditingId('new');
    setError('');
  }

  function openEdit(s: Service) {
    setForm(serviceToForm(s));
    setEditingId(s.id);
    setError('');
  }

  function cancel() {
    setEditingId(null);
    setError('');
  }

  function update(key: keyof ServiceForm, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  if (isLoading) {
    return <div className="p-4 max-w-2xl mx-auto text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Services</h1>
        {editingId === null && (
          <Button size="sm" onClick={openNew}>+ Add service</Button>
        )}
      </div>

      {/* Add / Edit form */}
      {editingId !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId === 'new' ? 'New service' : 'Edit service'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Service name</Label>
              <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Gel manicure" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="desc">Description (optional)</Label>
              <Input id="desc" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What's included?" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="price">Price (₦)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="100"
                  value={form.basePriceNaira}
                  onChange={(e) => update('basePriceNaira', e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="duration">Duration (mins)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  step="15"
                  value={form.durationMinutes}
                  onChange={(e) => update('durationMinutes', e.target.value)}
                  placeholder="60"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires-deposit"
                  checked={form.requiresDeposit}
                  onChange={(e) => update('requiresDeposit', e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor="requires-deposit">Require deposit to confirm booking</Label>
              </div>

              {form.requiresDeposit && (
                <div className="pl-6 space-y-3">
                  <div className="flex gap-3">
                    {(['percentage', 'fixed'] as const).map((type) => (
                      <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="depositType"
                          value={type}
                          checked={form.depositType === type}
                          onChange={() => update('depositType', type)}
                          className="accent-primary"
                        />
                        <span className="text-sm">{type === 'percentage' ? 'Percentage' : 'Fixed amount'}</span>
                      </label>
                    ))}
                  </div>

                  {form.depositType === 'percentage' ? (
                    <div className="space-y-1">
                      <Label htmlFor="dep-pct">Deposit %</Label>
                      <Input
                        id="dep-pct"
                        type="number"
                        min="1"
                        max="100"
                        value={form.depositPercent}
                        onChange={(e) => update('depositPercent', e.target.value)}
                        placeholder="30"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label htmlFor="dep-amt">Deposit amount (₦)</Label>
                      <Input
                        id="dep-amt"
                        type="number"
                        min="0"
                        value={form.depositNaira}
                        onChange={(e) => update('depositNaira', e.target.value)}
                        placeholder="2000"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name || !form.basePriceNaira}
                size="sm"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service list */}
      <div className="space-y-2">
        {services.length === 0 && editingId === null && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-3xl mb-2">✂️</p>
            <p className="font-medium">No services yet</p>
            <p className="text-sm mt-1">Add your first service to start accepting bookings</p>
          </div>
        )}
        {services.map((s) => (
          <Card key={s.id} className={s.isActive ? '' : 'opacity-50'}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                  )}
                  <p className="text-sm mt-1">
                    <span className="font-semibold text-primary">{formatNaira(s.basePriceKobo)}</span>
                    <span className="text-muted-foreground"> · {s.durationMinutes} mins</span>
                    {s.requiresDeposit && (
                      <span className="text-muted-foreground">
                        {' · '}
                        {s.depositType === 'percentage'
                          ? `${s.depositValue / 100}% deposit`
                          : `${formatNaira(s.depositValue)} deposit`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(s.id)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
