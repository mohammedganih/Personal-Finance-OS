'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, User, Shield } from 'lucide-react';
import { FamilySetup } from '@/components/settings/FamilySetup';
import { AccountSetup } from '@/components/settings/AccountSetup';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const logout = useLogout();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Settings</h2>
        <p className="text-sm text-text-secondary mt-0.5">Manage your account and family preferences</p>
      </div>

      {/* Family Members — most important for tracking */}
      <FamilySetup />

      {/* Bank Accounts */}
      <AccountSetup />

      {/* Profile */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Profile</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input defaultValue={user?.name} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input defaultValue={user?.email} disabled />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Security</h3>
        </div>
        <div className="space-y-1.5">
          <Label>Member since</Label>
          <Input value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} disabled />
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass-card rounded-2xl p-5 border border-danger/20">
        <h3 className="text-sm font-semibold text-danger mb-3">Danger Zone</h3>
        <Button variant="destructive" size="sm" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
