'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFamilyMembers, useCreateFamilyMember, useUpdateFamilyMember, useDeleteFamilyMember } from '@/hooks/useFamilyMembers';
import { FamilyMember } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const PRESET_COLORS = ['#7C3AED', '#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'];
const PRESET_EMOJIS = ['👤', '👩', '👨', '🧔', '👸', '🤴', '🧑'];

const schema = z.object({
  name:     z.string().min(1, 'Name required').max(50),
  relation: z.string().max(50).optional(),
  color:    z.string().optional(),
  emoji:    z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function MemberForm({ member, onClose }: { member?: FamilyMember; onClose: () => void }) {
  const isEdit = !!member;
  const { mutate: create, isPending: isCreating } = useCreateFamilyMember();
  const { mutate: update, isPending: isUpdating } = useUpdateFamilyMember();
  const isPending = isCreating || isUpdating;

  const [selectedColor, setSelectedColor] = useState(member?.color ?? PRESET_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState(member?.emoji ?? '👤');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: member?.name ?? '', relation: member?.relation ?? '' },
  });

  const onSubmit = (data: FormData) => {
    const payload = { ...data, color: selectedColor, emoji: selectedEmoji };
    if (isEdit) {
      update({ id: member.id, data: payload }, { onSuccess: onClose });
    } else {
      create(payload, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Member' : 'Add Family Member'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Emoji */}
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setSelectedEmoji(e)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-colors ${
                    selectedEmoji === e ? 'border-accent-violet bg-accent-violet/10' : 'border-border bg-bg-elevated'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: selectedColor === c ? 'white' : 'transparent',
                    transform: selectedColor === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Mohammed Gani" {...register('name')} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Relation</Label>
            <Input placeholder="Self, Spouse, Child..." {...register('relation')} />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: selectedColor + '25' }}>
              {selectedEmoji}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Preview</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: selectedColor }}>
                {selectedEmoji} {register('name').name}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FamilySetup() {
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const { data: members, isLoading } = useFamilyMembers();
  const { mutate: deleteMember } = useDeleteFamilyMember();

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Family Members</h3>
        </div>
        <Button size="sm" onClick={() => { setEditingMember(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <p className="text-xs text-text-secondary">
        Add all family members to track who paid, who owns which investment or loan, and get a per-person financial split.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 glass-card rounded-xl shimmer" />)}
        </div>
      ) : !members?.length ? (
        <div className="text-center py-6">
          <p className="text-sm text-text-muted mb-3">No members added yet</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Member
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated group">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: (m.color ?? '#7C3AED') + '25' }}
              >
                {m.emoji ?? '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{m.name}</p>
                {m.relation && <p className="text-xs text-text-muted">{m.relation}</p>}
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white shrink-0"
                style={{ background: m.color ?? '#7C3AED' }}
              >
                {m.emoji} {m.name}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingMember(m); setShowForm(true); }} className="p-1.5 rounded text-text-muted hover:text-accent-violet-light transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteMember(m.id)} className="p-1.5 rounded text-text-muted hover:text-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <MemberForm member={editingMember ?? undefined} onClose={() => { setShowForm(false); setEditingMember(null); }} />}
    </div>
  );
}
