'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Database, Download, ShieldAlert, Trash2, Plus, Check, ListTodo } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyTask {
  id: number;
  title: string;
  weekday: number | null;
  done: boolean;
}

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function AdminSecurity() {
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(true);

  async function loadTasks() {
    try {
      const res = await fetch('/api/weekly-tasks');
      const data = await res.json();
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch {
      // still
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  function handleBackup() {
    triggerDownload('/api/admin/backup');
    toast.success('Backup wird heruntergeladen – die JSON-Datei landet in deinen Downloads.');
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch('/api/admin/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Reset fehlgeschlagen.');
        return;
      }
      toast.success('Belege gelöscht: ' + (data?.totalDeleted ?? 0) + ' Datensätze. Kunden, Produkte, Tickets & Einstellungen bleiben erhalten.');
      setConfirmText('');
    } catch {
      toast.error('Reset fehlgeschlagen.');
    } finally {
      setResetting(false);
    }
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    try {
      const res = await fetch('/api/weekly-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Konnte Aufgabe nicht anlegen.');
        return;
      }
      setTasks((prev) => [...prev, data.task]);
      setNewTask('');
    } catch {
      toast.error('Konnte Aufgabe nicht anlegen.');
    }
  }

  async function toggleTask(t: WeeklyTask) {
    try {
      const res = await fetch('/api/weekly-tasks/' + t.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !t.done }),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => prev.map((x) => (x.id === t.id ? data.task : x)));
      }
    } catch {
      // ignore
    }
  }

  async function deleteTask(id: number) {
    try {
      const res = await fetch('/api/weekly-tasks/' + id, { method: 'DELETE' });
      if (res.ok) setTasks((prev) => prev.filter((x) => x.id !== id));
    } catch {
      // ignore
    }
  }

  const resetReady = confirmText.trim().toUpperCase() === 'LÖSCHEN';

  return (
    <div className="space-y-6">
      {/* Backup-Export */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Daten-Backup</h3>
            <p className="mt-1 text-sm text-gray-600">
              Exportiert alle Daten (Kunden, Belege, Ausgaben, Nutzer, Tickets, E-Mails …)
              als eine JSON-Datei. Sensible Felder wie IBAN oder Steuer-ID bleiben
              verschlüsselt. Bewahre die Datei sicher auf.
            </p>
            <Button onClick={handleBackup} className="mt-3 gap-2">
              <Download className="h-4 w-4" /> Backup herunterladen
            </Button>
          </div>
        </div>
      </Card>

      {/* Wochenaufgaben */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <ListTodo className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Wochenaufgaben</h3>
            <p className="mt-1 text-sm text-gray-600">
              Wiederkehrende To-dos (z. B. „Kasse zählen“, „Belege sortieren“).
            </p>

            <div className="mt-3 flex gap-2">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
                placeholder="Neue Aufgabe …"
                inputMode="text"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={true}
              />
              <Button onClick={addTask} className="gap-1 shrink-0">
                <Plus className="h-4 w-4" /> Hinzufügen
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {loadingTasks && <p className="text-sm text-gray-400">Lädt …</p>}
              {!loadingTasks && tasks.length === 0 && (
                <p className="text-sm text-gray-400">Noch keine Aufgaben.</p>
              )}
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleTask(t)}
                    className={
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border ' +
                      (t.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white')
                    }
                    aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
                  >
                    {t.done && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <span className={'flex-1 text-sm ' + (t.done ? 'text-gray-400 line-through' : 'text-gray-800')}>
                    {t.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTask(t.id)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Werksreset / Belege loeschen */}
      <Card className="border-red-200 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2 text-red-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-700">Belege löschen (Werksreset)</h3>
            <p className="mt-1 text-sm text-gray-600">
              Löscht <strong>alle Geschäftsbelege</strong>: Rechnungen, Aufträge, Angebote,
              Ausgaben, Arbeitsberichte, Erinnerungen und Abos. Die Nummernkreise werden
              auf 1 zurückgesetzt.
            </p>
            <p className="mt-2 text-sm text-gray-700">
              <strong>Bleibt erhalten:</strong> Kunden, Produkte, <strong>alle Tickets</strong>,
              Einstellungen, Nutzer/Mitarbeiter, Geräte, Termine, E-Mails und das Änderungsprotokoll.
            </p>
            <p className="mt-2 text-sm font-medium text-red-700">
              Dieser Schritt kann nicht rückgängig gemacht werden. Mach vorher ein Backup!
            </p>

            <div className="mt-3">
              <Label htmlFor="reset-confirm" className="text-sm text-gray-700">
                Zum Bestätigen <span className="font-mono font-semibold">LÖSCHEN</span> eingeben:
              </Label>
              <Input
                id="reset-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="LÖSCHEN"
                className="mt-1 max-w-xs"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <Button
              variant="destructive"
              disabled={!resetReady || resetting}
              onClick={handleReset}
              className="mt-3 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {resetting ? 'Lösche …' : 'Belege unwiderruflich löschen'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
