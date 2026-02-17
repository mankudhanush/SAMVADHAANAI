import React from 'react';
import {
    LayoutDashboard,
    Upload,
    ShieldAlert,
    FileText,
    AlertTriangle,
    Users,
    Gavel,
    Settings,
    LogOut,
    Globe,
    Mic,
    Shield,
} from 'lucide-react';
import { clsx } from 'clsx';

const Sidebar = ({ activeTab, setActiveTab, isOpen }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'upload', label: 'Upload & Query', icon: Upload },
        { id: 'analysis', label: 'Analysis', icon: Shield },
        { id: 'web-search', label: 'Web Search', icon: Globe },
        { id: 'voice', label: 'Voice', icon: Mic },
        { id: 'risk-scanner', label: 'Risk Scanner', icon: ShieldAlert },
        { id: 'plain-language', label: 'Plain Language', icon: FileText },
        { id: 'risk-score', label: 'Legal Risk Score', icon: AlertTriangle },
        { id: 'lawyer-recommendation', label: 'Lawyer Recommendation', icon: Gavel },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <aside
            className={clsx(
                "fixed inset-y-0 left-0 z-50 w-64 bg-primary text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shadow-xl flex flex-col h-full",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}
        >
            <div className="flex flex-col h-full">
                {/* Logo Area */}
                <div className="p-6 border-b border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                        <span className="font-bold text-lg">L</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Legal OS</h1>
                        <p className="text-xs text-gray-400">AI Document Intelligence</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200",
                                    isActive
                                        ? "bg-accent/20 text-accent border-r-4 border-accent"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <Icon size={20} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                {/* User / Footer */}
                <div className="p-4 border-t border-white/10">
                    <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <ShieldAlert size={14} />
                            <span className="text-xs font-bold uppercase tracking-wider">Privacy First</span>
                        </div>
                        <p className="text-[10px] text-emerald-200/70 leading-tight">
                            Local Processing Enabled. No data leaves your device.
                        </p>
                    </div>

                    <button className="flex items-center gap-3 w-full px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <LogOut size={20} />
                        <span className="text-sm font-medium">Sign Out</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
