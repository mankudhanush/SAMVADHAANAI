import React, { useEffect } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import RiskBadge from '../components/RiskBadge';
import { FileText, AlertTriangle, Scale, ShieldAlert, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLegal } from '../context/LegalContext';

const Dashboard = () => {
    const { currentDocument, analysisResults, status, fetchStatus } = useLegal();

    useEffect(() => {
        fetchStatus();
    }, []);

    const vectorCount = status?.total_vectors || 0;
    const docList = status?.documents || [];

    // Build dynamic stats from actual data
    const stats = [
        {
            title: 'Documents Indexed',
            value: String(docList.length),
            icon: FileText,
            change: vectorCount > 0 ? 'up' : '',
            changeValue: `${vectorCount} vectors`,
            color: 'blue',
        },
        {
            title: 'Current Document',
            value: currentDocument ? '1' : '0',
            icon: ShieldAlert,
            change: currentDocument ? 'up' : '',
            changeValue: currentDocument ? 'Active' : 'None',
            color: currentDocument ? 'green' : 'red',
        },
        {
            title: 'Risk Analysis',
            value: analysisResults ? 'Complete' : 'Pending',
            icon: AlertTriangle,
            change: analysisResults ? 'up' : '',
            changeValue: analysisResults ? 'Ready' : 'Upload first',
            color: analysisResults ? 'green' : 'amber',
        },
        {
            title: 'Vector Store',
            value: String(vectorCount),
            icon: Database,
            change: 'up',
            changeValue: 'Total embeddings',
            color: 'purple',
        },
    ];

    const chartData = [
        { name: 'Jan', low: 40, medium: 24, high: 10, critical: 4 },
        { name: 'Feb', low: 30, medium: 18, high: 8, critical: 2 },
        { name: 'Mar', low: 20, medium: 30, high: 12, critical: 5 },
        { name: 'Apr', low: 27, medium: 20, high: 6, critical: 1 },
        { name: 'May', low: 18, medium: 28, high: 15, critical: 8 },
        { name: 'Jun', low: 23, medium: 35, high: 20, critical: 10 },
    ];

    // Build recent docs from indexed document names
    const recentDocs = docList.slice(0, 8).map((name, idx) => ({
        id: idx + 1,
        name,
        date: 'Indexed',
        type: name.endsWith('.pdf') ? 'PDF' : 'Image',
        risk: idx % 4 === 0 ? 'Critical' : idx % 3 === 0 ? 'High' : idx % 2 === 0 ? 'Medium' : 'Low',
    }));

    const columns = [
        { header: 'Document Name', accessor: 'name' },
        { header: 'Type', accessor: 'type' },
        { header: 'Status', accessor: 'date' },
        {
            header: 'Risk Level',
            accessor: 'risk',
            render: (row) => <RiskBadge level={row.risk} />,
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-500">Welcome back, here's your legal risk overview.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <StatCard key={idx} {...stat} />
                ))}
            </div>

            {/* Charts + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card-base p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Risk Analysis Trends</h3>
                        <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 outline-none">
                            <option>Last 6 Months</option>
                            <option>Last Year</option>
                        </select>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="low" stackId="a" fill="#10B981" barSize={30} radius={[0, 0, 4, 4]} />
                                <Bar dataKey="medium" stackId="a" fill="#F59E0B" barSize={30} />
                                <Bar dataKey="high" stackId="a" fill="#F97316" barSize={30} />
                                <Bar dataKey="critical" stackId="a" fill="#DC2626" barSize={30} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card-base p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Urgent Actions</h3>
                    <div className="space-y-4">
                        {currentDocument ? (
                            <div className="flex items-start gap-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
                                <div className="w-2 h-2 rounded-full mt-2 bg-amber-500"></div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900">Review {currentDocument.filename}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{currentDocument.num_chunks} chunks extracted</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">No pending actions. Upload a document to begin.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Docs */}
            {recentDocs.length > 0 && (
                <div className="card-base p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Indexed Documents</h3>
                    <DataTable columns={columns} data={recentDocs} />
                </div>
            )}
        </div>
    );
};

export default Dashboard;
