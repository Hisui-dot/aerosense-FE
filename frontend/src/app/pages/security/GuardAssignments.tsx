import { useState } from 'react';
import { Edit2, Check, X, UserCheck, UserX, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  floor: string;
  zones: string[];
  guardName: string;
  badge: string;
  shift: 'Morning' | 'Afternoon' | 'Night';
  status: 'on-duty' | 'off-duty' | 'break';
  contact: string;
}

const SHIFTS: ('Morning' | 'Afternoon' | 'Night')[] = ['Morning', 'Afternoon', 'Night'];

const ALL_GUARDS = [
  'Officer Reyes',
  'Officer Santos',
  'Officer Bautista',
  'Officer Villanueva',
  'Officer Mendoza',
  'Officer Torres',
  'Officer Garcia',
  'Officer Lopez',
  'Officer Unassigned',
];

const INITIAL_ASSIGNMENTS: Assignment[] = [
  { id: 'f1', floor: 'Ground Floor', zones: ['Main Entrance', 'Cafeteria', 'Guard Post'], guardName: 'Officer Unassigned', badge: 'SEC-001', shift: 'Morning', status: 'on-duty', contact: '0917-001-0001' },
  { id: 'f2', floor: '1st Floor', zones: ['Lobby', 'CR – West', 'Admin Office'], guardName: 'Officer Reyes', badge: 'SEC-002', shift: 'Morning', status: 'on-duty', contact: '0917-001-0002' },
  { id: 'f3', floor: '2nd Floor', zones: ['CR – Boys', 'CR – Girls', 'Hallway'], guardName: 'Officer Santos', badge: 'SEC-003', shift: 'Morning', status: 'break', contact: '0917-001-0003' },
  { id: 'f4', floor: '3rd Floor', zones: ['CR – Boys', 'CR – Girls', 'Library'], guardName: 'Officer Bautista', badge: 'SEC-004', shift: 'Afternoon', status: 'on-duty', contact: '0917-001-0004' },
  { id: 'f5', floor: '4th Floor', zones: ['Faculty CR', 'Conference Rm'], guardName: 'Officer Villanueva', badge: 'SEC-005', shift: 'Afternoon', status: 'off-duty', contact: '0917-001-0005' },
  { id: 'f6', floor: 'Rooftop', zones: ['Rooftop Access', 'Fire Exit'], guardName: 'Officer Mendoza', badge: 'SEC-006', shift: 'Night', status: 'on-duty', contact: '0917-001-0006' },
];

const shiftColor = (shift: Assignment['shift']) => {
  if (shift === 'Morning') return 'bg-blue-100 text-blue-700';
  if (shift === 'Afternoon') return 'bg-orange-100 text-orange-700';
  return 'bg-indigo-100 text-indigo-700';
};

const statusConfig = (status: Assignment['status']) => {
  if (status === 'on-duty') return { label: 'On Duty', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
  if (status === 'break') return { label: 'On Break', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
  return { label: 'Off Duty', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
};

export const GuardAssignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGuard, setEditGuard] = useState('');
  const [editShift, setEditShift] = useState<Assignment['shift']>('Morning');
  const [editStatus, setEditStatus] = useState<Assignment['status']>('on-duty');
  const [activeShiftFilter, setActiveShiftFilter] = useState<'All' | 'Morning' | 'Afternoon' | 'Night'>('All');
  const [showGuardPicker, setShowGuardPicker] = useState(false);

  const onDutyCount = assignments.filter(a => a.status === 'on-duty').length;
  const offDutyCount = assignments.filter(a => a.status === 'off-duty').length;
  const onBreakCount = assignments.filter(a => a.status === 'break').length;

  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setEditGuard(a.guardName);
    setEditShift(a.shift);
    setEditStatus(a.status);
    setShowGuardPicker(false);
  };

  const saveEdit = (id: string) => {
    setAssignments(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, guardName: editGuard, shift: editShift, status: editStatus }
          : a
      )
    );
    toast.success('Assignment updated');
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowGuardPicker(false);
  };

  const filtered = assignments.filter(a =>
    activeShiftFilter === 'All' ? true : a.shift === activeShiftFilter
  );

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-24">

      {/* Summary */}
      <div className="px-4 pt-4 pb-3 w-full mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-1" />
            </div>
            <div className="font-bold text-2xl text-green-600">{onDutyCount}</div>
            <div className="text-xs text-gray-500 font-semibold">On Duty</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-1" />
            </div>
            <div className="font-bold text-2xl text-yellow-600">{onBreakCount}</div>
            <div className="text-xs text-gray-500 font-semibold">On Break</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-center mb-1">
              <div className="w-3 h-3 bg-gray-400 rounded-full mr-1" />
            </div>
            <div className="font-bold text-2xl text-gray-500">{offDutyCount}</div>
            <div className="text-xs text-gray-500 font-semibold">Off Duty</div>
          </div>
        </div>
      </div>

      {/* Shift Filter */}
      <div className="px-4 w-full mx-auto mb-3">
        <div className="flex gap-2 bg-white/30 rounded-xl p-1">
          {(['All', 'Morning', 'Afternoon', 'Night'] as const).map(s => (
            <button
              key={s}
              onClick={() => setActiveShiftFilter(s)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                activeShiftFilter === s
                  ? 'bg-white text-[#2665D0] shadow-sm'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment Cards */}
      <div className="px-4 w-full mx-auto space-y-3">
        {filtered.map(a => {
          const isEditing = editingId === a.id;
          const sc = statusConfig(a.status);

          return (
            <div key={a.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              {/* Floor Header */}
              <div className="bg-[#2665D0] px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-base">{a.floor}</div>
                  <div className="text-blue-200 text-xs mt-0.5">
                    {a.zones.join(' · ')}
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(a)}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <Edit2 className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>

              <div className="p-5">
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    {/* Guard Picker */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Assigned Guard
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setShowGuardPicker(!showGuardPicker)}
                          className="w-full flex items-center justify-between border-2 border-[#2665D0] rounded-xl px-4 py-3 bg-blue-50 text-left"
                        >
                          <span className="font-semibold text-gray-900">{editGuard}</span>
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        </button>
                        {showGuardPicker && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-48 overflow-y-auto">
                            {ALL_GUARDS.map(g => (
                              <button
                                key={g}
                                onClick={() => { setEditGuard(g); setShowGuardPicker(false); }}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                                  editGuard === g ? 'font-bold text-[#2665D0] bg-blue-50' : 'text-gray-800'
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shift */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Shift
                      </label>
                      <div className="flex gap-2">
                        {SHIFTS.map(s => (
                          <button
                            key={s}
                            onClick={() => setEditShift(s)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                              editShift === s
                                ? 'border-[#2665D0] bg-[#2665D0] text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Status
                      </label>
                      <div className="flex gap-2">
                        {(['on-duty', 'break', 'off-duty'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setEditStatus(s)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                              editStatus === s
                                ? s === 'on-duty' ? 'border-green-500 bg-green-500 text-white'
                                : s === 'break' ? 'border-yellow-500 bg-yellow-500 text-white'
                                : 'border-gray-500 bg-gray-500 text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {s === 'on-duty' ? 'On Duty' : s === 'break' ? 'Break' : 'Off Duty'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Save/Cancel */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => saveEdit(a.id)}
                        className="flex-1 bg-[#2665D0] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#1a4d9e] transition-colors"
                      >
                        <Check className="h-4 w-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        a.status === 'on-duty' ? 'bg-green-100' :
                        a.status === 'break' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {a.status !== 'off-duty'
                          ? <UserCheck className={`h-6 w-6 ${a.status === 'on-duty' ? 'text-green-600' : 'text-yellow-600'}`} />
                          : <UserX className="h-6 w-6 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-base">{a.guardName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Badge: {a.badge} · {a.contact}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${sc.color}`}>
                        <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${shiftColor(a.shift)}`}>
                        {a.shift} Shift
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 pt-4 w-full mx-auto">
        <div className="bg-white/80 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Legend</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              On Duty
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
              On Break
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
              Off Duty
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Edit2 className="h-3 w-3 text-gray-400" />
              Edit Assignment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
