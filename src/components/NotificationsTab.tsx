import React, { useState, useEffect } from 'react';
import { Reminder, AppNotification, UserProfile, Page } from '../types';
import { 
  addReminder, 
  updateReminder, 
  deleteReminder, 
  addNotification, 
  updateNotification, 
  deleteNotification 
} from '../dbHelper';
import { 
  requestNotificationPermission, 
  triggerPushNotification 
} from '../utils/fcm';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Check, 
  Clock, 
  Sparkles, 
  ShieldAlert, 
  RefreshCw, 
  ToggleLeft, 
  ToggleRight, 
  Settings, 
  HelpCircle,
  TrendingUp,
  CreditCard,
  Home,
  Briefcase,
  Heart,
  Car,
  FileText,
  Activity
} from 'lucide-react';

interface NotificationsTabProps {
  reminders: Reminder[];
  appNotifications: AppNotification[];
  profile: UserProfile | null;
  currencySymbol: string;
  darkMode: boolean;
  onNavigate: (page: Page) => void;
}

export default function NotificationsTab({
  reminders,
  appNotifications,
  profile,
  currencySymbol,
  darkMode,
  onNavigate
}: NotificationsTabProps) {
  // UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Form states for new Reminder
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<Reminder['type']>('loan_emi');
  const [amount, setAmount] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [frequency, setFrequency] = useState<Reminder['frequency']>('monthly');
  const [enabled, setEnabled] = useState<boolean>(true);

  // Settings states (stored in local preferences/localstorage for persistence)
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean>(false);
  const [muteSuccessAlerts, setMuteSuccessAlerts] = useState<boolean>(false);

  // Query notification permission on mount
  useEffect(() => {
    try {
      if ('Notification' in window) {
        setNotificationsAllowed(Notification.permission === 'granted');
      }
    } catch (e) {
      console.warn('Notification permission query blocked in iframe sandbox:', e);
      setNotificationsAllowed(false);
    }
  }, []);

  // Clear messages automatically
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Handle request for browser push notifications
  const handleEnablePush = async () => {
    try {
      const granted = await requestNotificationPermission();
      setNotificationsAllowed(granted);
      if (granted) {
        setSuccessMsg('Push notifications successfully enabled on this browser!');
        await triggerPushNotification(
          'Notifications Active! 🔔',
          'BudgetBloom will now alert you of upcoming payments and policy renewals.',
          'budgetbloom-activated'
        );
      } else {
        setErrorMsg('Notification permission denied or blocked by your browser settings.');
      }
    } catch (err: any) {
      setErrorMsg('Error enabling push notifications: ' + err.message);
    }
  };

  // Submit new reminder
  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !dueDate) {
      setErrorMsg('Please specify both a Reminder Title and a Due Date.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const newReminderPayload = {
        userId: profile.uid,
        title: title.trim(),
        type,
        amount: amount ? parseFloat(amount) : 0,
        dueDate,
        frequency,
        enabled
      };

      await addReminder(newReminderPayload);
      
      setSuccessMsg(`"${title}" reminder created successfully!`);
      // Reset fields
      setTitle('');
      setAmount('');
      setDueDate('');
    } catch (err: any) {
      setErrorMsg('Error creating reminder: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle single reminder's active status
  const handleToggleReminder = async (reminder: Reminder) => {
    if (!profile) return;
    try {
      await updateReminder(reminder.id, {
        userId: profile.uid,
        enabled: !reminder.enabled
      });
      setSuccessMsg(`Reminder "${reminder.title}" status updated.`);
    } catch (err: any) {
      setErrorMsg('Error modifying reminder status: ' + err.message);
    }
  };

  // Delete a reminder
  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder(id);
      setSuccessMsg('Reminder removed successfully.');
    } catch (err: any) {
      setErrorMsg('Error deleting reminder: ' + err.message);
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (notification: AppNotification) => {
    if (!profile) return;
    try {
      await updateNotification(notification.id, {
        userId: profile.uid,
        read: true
      });
    } catch (err: any) {
      setErrorMsg('Error updating notification: ' + err.message);
    }
  };

  // Delete a single notification from history
  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (err: any) {
      setErrorMsg('Error removing notification: ' + err.message);
    }
  };

  // Mark all user notifications as read
  const handleMarkAllRead = async () => {
    if (!profile) return;
    try {
      const unread = appNotifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateNotification(n.id, {
        userId: profile.uid,
        read: true
      })));
      setSuccessMsg('All notifications marked as read.');
    } catch (err: any) {
      setErrorMsg('Error clearing alerts: ' + err.message);
    }
  };

  // Help map icon according to reminder type
  const getReminderIcon = (remType: string) => {
    switch (remType) {
      case 'loan_emi':
        return <Briefcase className="w-5 h-5 text-amber-600" />;
      case 'credit_card':
        return <CreditCard className="w-5 h-5 text-[#D6A51D]" />;
      case 'rent':
        return <Home className="w-5 h-5 text-[#355C4B]" />;
      case 'sip':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'savings_goal':
        return <Sparkles className="w-5 h-5 text-blue-600" />;
      case 'health_insurance':
        return <Heart className="w-5 h-5 text-rose-500" />;
      case 'vehicle_insurance':
        return <Car className="w-5 h-5 text-cyan-600" />;
      case 'life_insurance':
        return <Activity className="w-5 h-5 text-indigo-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  // Convert key enum string to beautiful human format
  const getReminderLabel = (remType: string) => {
    switch (remType) {
      case 'loan_emi': return 'Loan EMI';
      case 'credit_card': return 'Credit Card Bill';
      case 'rent': return 'Rent Payment';
      case 'sip': return 'SIP Investment';
      case 'savings_goal': return 'Savings Goal';
      case 'health_insurance': return 'Health Insurance';
      case 'vehicle_insurance': return 'Vehicle Insurance';
      case 'life_insurance': return 'Life Insurance';
      case 'custom_policy': return 'Custom Policy Renewal';
      default: return 'Custom Alert';
    }
  };

  // Trigger Immediate Mock Reminder Event for testing push and logs
  const handleSimulateReminder = async (rem: Reminder) => {
    if (!profile) return;
    try {
      const amtStr = rem.amount > 0 ? ` of ${currencySymbol}${rem.amount.toLocaleString()}` : '';
      const text = `Due Alert: Your "${rem.title}" (${getReminderLabel(rem.type)})${amtStr} is scheduled for renewal/payment on ${rem.dueDate}.`;
      
      // 1. Add notification to user subcollection in Firestore
      await addNotification({
        userId: profile.uid,
        text,
        type: 'alert'
      });

      // 2. Trigger real desktop notification
      await triggerPushNotification(
        `BudgetBloom: ${getReminderLabel(rem.type)} Due!`,
        `"${rem.title}"${amtStr} is due on ${rem.dueDate}. Tap to check settings.`,
        `reminder-${rem.id}`
      );

      setSuccessMsg(`Simulated event for "${rem.title}". Push notification triggered and added to logs!`);
    } catch (err: any) {
      setErrorMsg('Error simulating reminder alert: ' + err.message);
    }
  };

  // Format timestamp helper
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto text-[#1F2933]" id="notifications-tab-root">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-[#2F6B52] flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#D6A51D]" />
            Notification & Reminder Center
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Store and manage scheduled loan EMIs, utility bills, SIP investment targets, and insurance renewals.
          </p>
        </div>

        {/* Browser Push Quick Control Status */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleEnablePush}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow transition-all cursor-pointer ${
              notificationsAllowed 
                ? 'bg-[#EEF6F2] text-[#2F6B52] border border-[#2F6B52]/20 cursor-default shadow-none' 
                : 'bg-gradient-to-r from-[#2F6B52] to-[#3E8B6B] hover:from-[#255541] hover:to-[#337459] text-white hover:shadow-md active:scale-95'
            }`}
            id="btn-toggle-browser-push"
          >
            <Sparkles className="w-4 h-4 shrink-0 text-[#D6A51D]" />
            {notificationsAllowed ? 'Desktop Push Active' : 'Enable Push Notifications'}
          </button>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle className="w-4.5 h-4.5 text-[#2F6B52] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Workspace Grid: Left Side Forms + Reminders, Right Side Settings + History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Add New Reminder + Active List */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Create Reminder Form Card */}
          <div className="bg-white rounded-2xl border border-[#DCE8E1] shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow">
            <h3 className="font-display font-extrabold text-sm text-[#2F6B52] pb-3 border-b border-[#DCE8E1] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#D6A51D]" />
              Schedule New Reminder
            </h3>

            <form onSubmit={handleCreateReminder} className="mt-4 space-y-4" id="create-reminder-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reminder Label / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Home Loan, Care Health"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2F6B52]/10 focus:border-[#2F6B52] text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Type Selection */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reminder Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Reminder['type'])}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2F6B52]/10 focus:border-[#2F6B52] text-slate-800"
                  >
                    <optgroup label="Financial Reminders">
                      <option value="loan_emi">Loan EMI Reminder</option>
                      <option value="credit_card">Credit Card Bill</option>
                      <option value="rent">Rent Payment</option>
                      <option value="sip">SIP Investment target</option>
                      <option value="savings_goal">Savings Goal Target</option>
                    </optgroup>
                    <optgroup label="Insurance & Policy Alerts">
                      <option value="health_insurance">Health Insurance Renewal</option>
                      <option value="vehicle_insurance">Vehicle Insurance Renewal</option>
                      <option value="life_insurance">Life Insurance Renewal</option>
                      <option value="custom_policy">Custom Policy Expiry</option>
                    </optgroup>
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount ({currencySymbol}) <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currencySymbol}</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-xs font-semibold pl-8 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2F6B52]/10 focus:border-[#2F6B52] text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Reminder Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2F6B52]/10 focus:border-[#2F6B52] text-slate-800"
                  />
                </div>

                {/* Reminder Frequency */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reminder Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as Reminder['frequency'])}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2F6B52]/10 focus:border-[#2F6B52] text-slate-800"
                  >
                    <option value="one-time">One-time alert</option>
                    <option value="daily">Daily alert</option>
                    <option value="weekly">Weekly alert</option>
                    <option value="monthly">Monthly recurring</option>
                    <option value="yearly">Yearly recurring</option>
                  </select>
                </div>

                {/* Enabled Status */}
                <div className="flex items-center gap-2 pt-6">
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className="text-slate-500 hover:text-slate-700 focus:outline-none flex items-center gap-1.5 cursor-pointer"
                  >
                    {enabled ? (
                      <ToggleRight className="w-8 h-8 text-[#2F6B52]" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-300" />
                    )}
                    <span className="text-xs font-bold text-slate-600">Status: {enabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2F6B52] hover:bg-[#204a38] text-white py-2.5 px-4 rounded-xl text-xs font-extrabold shadow-md shadow-[#2F6B52]/10 hover:shadow-lg transition-all active:scale-98 disabled:opacity-75 cursor-pointer"
                >
                  {loading ? 'Adding Reminder...' : 'Create Scheduled Reminder'}
                </button>
              </div>
            </form>
          </div>

          {/* List of Active Reminders */}
          <div className="bg-white rounded-2xl border border-[#DCE8E1] shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8E1]">
              <h3 className="font-display font-extrabold text-sm text-[#2F6B52] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D6A51D]" />
                Active Reminders & Policy Schedules ({reminders.length})
              </h3>
            </div>

            {reminders.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                <Bell className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-400">No scheduled reminders found. Create one above to begin.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto pr-1">
                {reminders.map((rem) => {
                  const isOverdue = new Date(rem.dueDate).getTime() < new Date().setHours(0,0,0,0);
                  return (
                    <div 
                      key={rem.id} 
                      className={`py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors border-b border-slate-100 last:border-0 ${
                        !rem.enabled ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Rounded Type Icon */}
                        <div className="p-2.5 rounded-xl bg-[#EEF6F2] shrink-0 shadow-xs border border-[#DCE8E1] mt-0.5">
                          {getReminderIcon(rem.type)}
                        </div>

                        {/* Text and status details */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 truncate flex flex-wrap items-center gap-1.5 leading-snug">
                            {rem.title}
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#EEF6F2] text-[#2F6B52] font-extrabold tracking-wide uppercase border border-[#2F6B52]/10">
                              {rem.frequency}
                            </span>
                          </p>
                          <p className="text-xs text-slate-450 mt-1">
                            Category: <span className="font-semibold text-slate-600">{getReminderLabel(rem.type)}</span>
                          </p>
                          
                          {/* Due date status indicator */}
                          <p className="text-xs flex items-center gap-1.5 mt-1.5 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-[#D6A51D]" />
                            <span className="text-slate-450">Due:</span> 
                            <span className={isOverdue && rem.enabled ? 'text-rose-500' : 'text-slate-600'}>{rem.dueDate}</span>
                            {isOverdue && rem.enabled && (
                              <span className="text-[8px] bg-[#FFFBEB] text-[#D6A51D] border border-[#FDE68A] px-1.5 py-0.5 rounded font-extrabold tracking-wide uppercase flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-[#D6A51D]" />
                                Overdue
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Controls Panel */}
                      <div className="flex items-center gap-3 self-stretch sm:self-center justify-between sm:justify-end shrink-0 pl-14 sm:pl-0">
                        {/* Amount if specified */}
                        {rem.amount > 0 ? (
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-extrabold text-slate-800">
                              {currencySymbol}{rem.amount.toLocaleString()}
                            </p>
                            <span className="text-[9px] text-slate-400 font-semibold block sm:hidden">Amount due</span>
                          </div>
                        ) : (
                          <div className="block sm:hidden text-slate-300">No amount</div>
                        )}

                        <div className="flex items-center gap-2">
                          {/* MOCK TRIGGER ACTION (Test push and log) */}
                          <button
                            type="button"
                            onClick={() => handleSimulateReminder(rem)}
                            className="px-3 py-2 rounded-xl bg-white hover:bg-[#EEF6F2] text-[11px] font-extrabold text-[#2F6B52] border border-[#DCE8E1] transition-colors flex items-center gap-1.5 active:scale-95 min-h-[40px] shadow-xs cursor-pointer"
                            title="Simulate Event Immediately"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-[#D6A51D]" />
                            <span>Simulate</span>
                          </button>

                          {/* Enable/Disable toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleReminder(rem)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px] cursor-pointer"
                            title={rem.enabled ? 'Deactivate Reminder' : 'Activate Reminder'}
                          >
                            {rem.enabled ? (
                              <ToggleRight className="w-7 h-7 text-[#2F6B52]" />
                            ) : (
                              <ToggleLeft className="w-7 h-7 text-slate-300" />
                            )}
                          </button>

                          {/* Delete Trash */}
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(rem.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-150 active:scale-90 flex items-center justify-center min-w-[40px] min-h-[40px] border border-transparent hover:border-rose-100 shadow-xs cursor-pointer"
                            title="Remove Reminder"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Settings Panel + Notification History */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Notification Settings card */}
          <div className="bg-white rounded-2xl border border-[#DCE8E1] shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow">
            <h3 className="font-display font-extrabold text-sm text-[#2F6B52] pb-3 border-b border-[#DCE8E1] flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#D6A51D]" />
              FCM & Frequency Rules
            </h3>

            <div className="mt-4 space-y-3.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-700">Enable FCM Cloud Messaging</p>
                  <p className="text-[10px] text-slate-400">Show background browser & mobile push tags.</p>
                </div>
                <button 
                  type="button"
                  onClick={handleEnablePush} 
                  className="focus:outline-none cursor-pointer"
                >
                  {notificationsAllowed ? (
                    <ToggleRight className="w-8 h-8 text-[#2F6B52]" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#DCE8E1]">
                <div>
                  <p className="font-bold text-slate-700">Automatic Reminder Verification</p>
                  <p className="text-[10px] text-slate-450">Assess calendar offsets when BudgetBloom starts up.</p>
                </div>
                <div className="flex items-center gap-1 font-bold text-[#2F6B52] bg-[#EEF6F2] px-2.5 py-1 rounded-lg text-[10px] border border-[#2F6B52]/10">
                  <Check className="w-3.5 h-3.5" />
                  Active
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#DCE8E1]">
                <div>
                  <p className="font-bold text-slate-700">Mute Non-Critical System Popups</p>
                  <p className="text-[10px] text-slate-450">Limit standard info logs and display high alerts only.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setMuteSuccessAlerts(!muteSuccessAlerts)} 
                  className="focus:outline-none cursor-pointer"
                >
                  {muteSuccessAlerts ? (
                    <ToggleRight className="w-8 h-8 text-[#2F6B52]" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* History Page / Log List */}
          <div className="bg-white rounded-2xl border border-[#DCE8E1] shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8E1]">
              <h3 className="font-display font-extrabold text-sm text-[#2F6B52] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#D6A51D]" />
                Notification History
              </h3>

              {appNotifications.some(n => !n.read) && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[10px] font-extrabold text-[#2F6B52] hover:text-[#D6A51D] uppercase hover:underline cursor-pointer"
                >
                  Mark All Read
                </button>
              )}
            </div>

            {appNotifications.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-400">Your notification log history is clear.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1 mt-2">
                {appNotifications.map((notif) => {
                  const isUnread = !notif.read;
                  return (
                    <div 
                      key={notif.id} 
                      className={`p-3.5 my-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 bg-white hover:bg-[#EEF6F2]/40 ${
                        isUnread 
                          ? 'border-amber-200 bg-[#FFFDF5]/75 shadow-sm' 
                          : 'border-slate-100/80 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex gap-3 items-start">
                        {/* Status Icon Indicator */}
                        <div className="mt-0.5 shrink-0">
                          {notif.type === 'alert' ? (
                            <div className="p-1.5 rounded-lg bg-amber-50 text-[#D6A51D]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          ) : notif.type === 'success' ? (
                            <div className="p-1.5 rounded-lg bg-[#EEF6F2] text-[#2F6B52]">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-[#EEF6F2] text-[#2F6B52]">
                              <Bell className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-relaxed ${
                            notif.read ? 'text-slate-500 font-medium' : 'text-slate-800 font-semibold'
                          }`}>
                            {notif.text}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {formatTime(notif.createdAt)}
                            </span>
                            
                            {/* Badges */}
                            <span className={`text-[8.5px] px-2 py-0.5 rounded-md font-extrabold tracking-wide uppercase border ${
                              notif.type === 'alert' 
                                ? 'bg-amber-50 text-[#D6A51D] border-amber-200' 
                                : notif.type === 'success' 
                                  ? 'bg-[#EEF6F2] text-[#2F6B52] border-[#2F6B52]/10'
                                  : 'bg-[#EEF6F2] text-[#2F6B52] border-[#2F6B52]/10'
                            }`}>
                              {notif.type}
                            </span>

                            {isUnread && (
                              <span className="text-[8.5px] px-2 py-0.5 rounded-md font-extrabold tracking-wide uppercase bg-[#FFFBEB] text-[#D6A51D] border border-[#FDE68A] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D6A51D] animate-ping" />
                                Unread
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons on History Item */}
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(notif)}
                            className="p-1.5 rounded-lg bg-[#EEF6F2] text-[#2F6B52] hover:bg-[#2F6B52] hover:text-white transition-all shadow-xs active:scale-90 cursor-pointer"
                            title="Mark as Read"
                          >
                            <Check className="w-3.5 h-3.5 font-bold" />
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteNotification(notif.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-90 cursor-pointer"
                          title="Delete log entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
