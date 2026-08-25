import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord, LeaveApplication, StaffProfile } from '../../types';
import { BadgeCheck, CalendarDays, Check, Clock3, FileUser, MapPin, Send, Users, X } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const timeNow = () => new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

export const StaffPortalView: React.FC = () => {
  const {
    currentUser,
    users,
    isAdmin,
    attendanceRecords,
    leaveApplications,
    updateUserStaffProfile,
    addAttendanceRecord,
    addLeaveApplication,
    updateLeaveApplication,
    showToast,
  } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'attendance' | 'leave'>('overview');
  const [profile, setProfile] = useState<StaffProfile>(currentUser.staffProfile || {
    staffId: currentUser.id,
    designation: currentUser.role,
    department: 'Legal Practice',
    phone: '',
    emergencyContact: '',
    joinDate: '',
    employmentType: currentUser.role === 'Reviewer' ? 'Freelance' : 'Permanent',
    officeLocation: 'Kuala Lumpur Office',
    bio: '',
  });
  const [leaveType, setLeaveType] = useState<LeaveApplication['leaveType']>('Annual');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');

  const isStaff = currentUser.role !== 'Client';
  const myAttendance = attendanceRecords.filter((record) => record.userId === currentUser.id);
  const myLeave = leaveApplications.filter((leave) => leave.userId === currentUser.id);
  const todayAttendance = myAttendance.find((record) => record.date === today());
  const pendingLeaves = leaveApplications.filter((leave) => leave.status === 'Pending');
  const activeStaff = users.filter((user) => user.role !== 'Client' && user.status === 'Active');
  const userName = (userId: string) => users.find((user) => user.id === userId)?.name || userId;

  const daysRequested = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  }, [startDate, endDate]);

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    updateUserStaffProfile(currentUser.id, profile);
  };

  const recordAttendance = (status: AttendanceRecord['status']) => {
    const existing = todayAttendance;
    addAttendanceRecord({
      id: existing?.id || `ATT-${Date.now()}`,
      userId: currentUser.id,
      date: today(),
      checkIn: existing?.checkIn || timeNow(),
      checkOut: status === 'Present' && existing?.checkIn ? timeNow() : existing?.checkOut,
      status,
      notes: profile.officeLocation,
    });
  };

  const submitLeave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || !daysRequested) {
      showToast('Please choose valid dates and provide a reason.');
      return;
    }
    addLeaveApplication({
      id: `LV-${Date.now()}`,
      userId: currentUser.id,
      leaveType,
      startDate,
      endDate,
      days: daysRequested,
      reason: reason.trim(),
      status: 'Pending',
      submittedAt: new Date().toISOString(),
    });
    setReason('');
  };

  if (!isStaff) return <div className="p-8 text-center">Staff Portal is available to staff accounts only.</div>;

  return (
    <div className="space-y-5 text-xs pb-10">
      <section className="bg-[#16223A] text-white rounded-2xl p-5 shadow-lg border border-[#A9814A]/40 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold">People &amp; Operations</div>
          <h2 className="font-serif text-2xl font-bold mt-1">Staff Portal</h2>
          <p className="text-slate-300 mt-1 max-w-xl">Your staff identity, attendance, leave, and internal profile in one secure workspace.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl p-3 min-w-[230px]">
          <div className="w-10 h-10 rounded-full bg-[#A9814A] text-[#16223A] flex items-center justify-center font-serif font-bold">{currentUser.name.slice(0, 1)}</div>
          <div>
            <div className="font-bold text-sm">{currentUser.name}</div>
            <div className="text-[10px] text-slate-300">{profile.staffId} &bull; {currentUser.role}</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-[#E1DCCF] pb-2">
        {[
          ['overview', 'Overview', BadgeCheck],
          ['profile', 'My Profile', FileUser],
          ['attendance', 'Attendance', Clock3],
          ['leave', 'Leave', CalendarDays],
        ].map(([tab, label, Icon]) => (
          <button key={tab as string} onClick={() => setActiveTab(tab as typeof activeTab)} className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ${activeTab === tab ? 'bg-[#16223A] text-white' : 'bg-white text-slate-600 border border-[#E1DCCF]'}`}>
            <Icon className="w-3.5 h-3.5 text-[#A9814A]" /> {label as string}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-4"><div className="text-slate-500 uppercase text-[10px] font-bold">Today</div><div className="font-serif text-xl font-bold text-[#16223A] mt-1">{todayAttendance ? todayAttendance.status : 'Not recorded'}</div><div className="text-[11px] text-slate-500 mt-1">{todayAttendance ? `${todayAttendance.checkIn}${todayAttendance.checkOut ? ` - ${todayAttendance.checkOut}` : ''}` : 'Record your attendance below.'}</div></div>
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-4"><div className="text-slate-500 uppercase text-[10px] font-bold">Leave Balance</div><div className="font-serif text-xl font-bold text-[#16223A] mt-1">{20 - myLeave.filter((l) => l.status === 'Approved' && l.leaveType === 'Annual').reduce((sum, l) => sum + l.days, 0)} days</div><div className="text-[11px] text-slate-500 mt-1">Annual leave estimate</div></div>
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-4"><div className="text-slate-500 uppercase text-[10px] font-bold">Open Applications</div><div className="font-serif text-xl font-bold text-[#16223A] mt-1">{myLeave.filter((l) => l.status === 'Pending').length}</div><div className="text-[11px] text-slate-500 mt-1">Awaiting administrator review</div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 space-y-3">
              <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2"><Clock3 className="w-4 h-4 text-[#A9814A]" /> Quick attendance</h3>
              <p className="text-slate-500">Mark your office presence for {today()}.</p>
              <div className="flex gap-2"><button onClick={() => recordAttendance('Present')} className="px-3 py-2 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"><Check className="w-3.5 h-3.5 inline mr-1" /> Check in / out</button><button onClick={() => recordAttendance('Remote')} className="px-3 py-2 rounded-lg bg-[#16223A] text-white font-bold cursor-pointer"><MapPin className="w-3.5 h-3.5 inline mr-1" /> Working remotely</button></div>
            </div>
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 space-y-3">
              <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#A9814A]" /> Leave applications</h3>
              {myLeave.slice(0, 3).map((leave) => <div key={leave.id} className="flex items-center justify-between border-b border-slate-100 pb-2"><span className="font-semibold">{leave.leaveType} <span className="text-slate-400">{leave.startDate} - {leave.endDate}</span></span><span className={`font-bold ${leave.status === 'Approved' ? 'text-emerald-700' : leave.status === 'Rejected' ? 'text-rose-700' : 'text-amber-700'}`}>{leave.status}</span></div>)}
              {!myLeave.length && <p className="text-slate-500">No leave applications yet.</p>}
            </div>
          </div>
          {isAdmin && <div className="bg-white border border-[#E1DCCF] rounded-xl p-4"><h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2"><Users className="w-4 h-4 text-[#A9814A]" /> Pending approvals ({pendingLeaves.length})</h3>{pendingLeaves.map((leave) => <div key={leave.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 py-3"><div><b>{userName(leave.userId)}</b> requested {leave.leaveType} for {leave.days} day(s), {leave.startDate} to {leave.endDate}<div className="text-slate-500 mt-0.5">{leave.reason}</div></div><div className="flex gap-2"><button onClick={() => updateLeaveApplication(leave.id, { status: 'Approved', reviewedBy: currentUser.name, reviewedAt: new Date().toISOString() })} className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-bold cursor-pointer">Approve</button><button onClick={() => updateLeaveApplication(leave.id, { status: 'Rejected', reviewedBy: currentUser.name, reviewedAt: new Date().toISOString() })} className="px-3 py-1.5 bg-rose-700 text-white rounded-lg font-bold cursor-pointer">Reject</button></div></div>)}</div>}
          {isAdmin && <div className="text-[11px] text-slate-500">Active staff accounts: {activeStaff.length}. Review access and profiles from Users.</div>}
        </>
      )}

      {activeTab === 'profile' && <form onSubmit={saveProfile} className="bg-white border border-[#E1DCCF] rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><h3 className="font-serif text-lg font-bold text-[#16223A]">Staff profile &amp; bio data</h3><p className="text-slate-500 mt-1">Keep your internal contact and employment details current.</p></div>
        {[['staffId', 'Staff ID'], ['designation', 'Designation'], ['department', 'Department'], ['phone', 'Phone'], ['emergencyContact', 'Emergency contact'], ['joinDate', 'Join date'], ['officeLocation', 'Office location']].map(([key, label]) => <label key={key} className="font-bold text-slate-700">{label}<input type={key === 'joinDate' ? 'date' : 'text'} value={profile[key as keyof StaffProfile] as string} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} className="w-full mt-1" /></label>)}
        <label className="font-bold text-slate-700">Employment type<select value={profile.employmentType} onChange={(e) => setProfile({ ...profile, employmentType: e.target.value as StaffProfile['employmentType'] })} className="w-full mt-1"><option>Permanent</option><option>Contract</option><option>Freelance</option><option>Intern</option></select></label>
        <label className="md:col-span-2 font-bold text-slate-700">Professional bio<textarea rows={4} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} className="w-full mt-1" placeholder="Short internal biography, practice focus, and relevant experience" /></label>
        <div className="md:col-span-2"><button className="px-4 py-2 bg-[#16223A] text-white rounded-lg font-bold cursor-pointer"><Send className="w-3.5 h-3.5 inline mr-1" /> Save profile</button></div>
      </form>}

      {activeTab === 'attendance' && <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-serif text-lg font-bold text-[#16223A]">Attendance history</h3><p className="text-slate-500 mt-1">Record office, remote, leave, or absence status.</p></div><div className="flex gap-2"><button onClick={() => recordAttendance('Present')} className="px-3 py-2 bg-emerald-700 text-white rounded-lg font-bold cursor-pointer">Check in / out</button><button onClick={() => recordAttendance('Remote')} className="px-3 py-2 bg-[#16223A] text-white rounded-lg font-bold cursor-pointer">Remote</button></div></div>{myAttendance.map((record) => <div key={record.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 border-t border-slate-100 py-3"><span className="font-bold">{record.date}</span><span>{record.status}</span><span>In: {record.checkIn}</span><span>Out: {record.checkOut || '-'}</span><span className="text-slate-500">{record.notes}</span></div>)}{!myAttendance.length && <p className="text-slate-500 py-6 text-center">No attendance records yet.</p>}</div>}

      {activeTab === 'leave' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><form onSubmit={submitLeave} className="bg-white border border-[#E1DCCF] rounded-xl p-5 space-y-3"><h3 className="font-serif text-lg font-bold text-[#16223A]">Apply for leave</h3><label className="font-bold text-slate-700">Leave type<select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveApplication['leaveType'])} className="w-full mt-1"><option>Annual</option><option>Medical</option><option>Emergency</option><option>Unpaid</option><option>Replacement</option></select></label><div className="grid grid-cols-2 gap-3"><label className="font-bold text-slate-700">From<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-1" /></label><label className="font-bold text-slate-700">To<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full mt-1" /></label></div><div className="text-slate-500">Requested days: <b>{daysRequested || 'Invalid dates'}</b></div><label className="font-bold text-slate-700">Reason<textarea required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1" /></label><button className="px-4 py-2 bg-[#16223A] text-white rounded-lg font-bold cursor-pointer"><Send className="w-3.5 h-3.5 inline mr-1" /> Submit application</button></form><div className="bg-white border border-[#E1DCCF] rounded-xl p-5"><h3 className="font-serif text-lg font-bold text-[#16223A]">My applications</h3>{myLeave.map((leave) => <div key={leave.id} className="border-b border-slate-100 py-3"><div className="flex justify-between"><b>{leave.leaveType} &bull; {leave.days} day(s)</b><span className="font-bold">{leave.status}</span></div><div className="text-slate-500">{leave.startDate} to {leave.endDate}</div><div className="mt-1">{leave.reason}</div></div>)}{!myLeave.length && <p className="text-slate-500 mt-3">No applications submitted.</p>}</div></div>}
    </div>
  );
};
