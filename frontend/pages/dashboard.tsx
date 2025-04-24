import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import DomainForm from '../components/DomainForm';
import ReportTable from '../components/ReportTable';

interface Domain {
  _id: string;
  url: string;
  schedule: string;
}

interface Report {
  _id: string;
  domainId: string;
  brokenLinks: { url: string; status: string; source: string }[];
  checkedUrls: string[];
  createdAt: string;
}

export default function Dashboard() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { session_id } = router.query;

  useEffect(() => {
    fetchData();
    if (session_id) {
      // Refresh plan after successful checkout
      checkSubscriptionStatus();
    }
  }, [session_id]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please log in');
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const [domainsRes, reportsRes, statusRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/domains`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/reports`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/status`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setDomains(domainsRes.data || []);
      setReports(reportsRes.data || []);
      setPlan(statusRes.data.plan || 'free');
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        toast.error('Session expired. Please log in again.');
        router.push('/login');
      } else {
        toast.error('Failed to load data');
      }
      setDomains([]);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const statusRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlan(statusRes.data.plan || 'free');
      toast.success(`Plan updated to ${statusRes.data.plan}`);
      // Remove session_id from URL
      router.replace('/dashboard', undefined, { shallow: true });
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/domains/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDomains(domains.filter((domain) => domain._id !== id));
      toast.success('Domain deleted');
    } catch (error) {
      toast.error('Failed to delete domain');
    }
  };

  const handleManualScan = async (domainId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/scan/${domainId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Scan started');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to start scan');
    }
  };

  const planLimits = { free: 1, basic: 5, advanced: 'Unlimited' };

  return (
    <div>
      <Head>
        <title>Dashboard - Website Link Checker</title>
        <meta name="description" content="Manage your domains and view broken link reports." />
      </Head>
      <Navbar />
      <main className="container">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <div className="card mb-4">
          <p className="mb-2">Current Plan: <span className="capitalize">{plan}</span></p>
          <p>Domains: {domains.length} / {planLimits[plan]}</p>
        </div>
        <DomainForm onAdd={fetchData} domainCount={domains.length} plan={plan} />
        <h2 className="text-xl font-bold mt-8 mb-4">Your Domains</h2>
        {loading ? (
          <p>Loading domains...</p>
        ) : domains.length === 0 ? (
          <p>No domains added yet.</p>
        ) : (
          <ul className="space-y-2">
            {domains.map((domain) => (
              <li key={domain._id} className="flex items-center justify-between p-2 border rounded">
                <span>{domain.url} ({domain.schedule})</span>
                <div>
                  <button
                    onClick={() => handleManualScan(domain._id)}
                    className="mr-2 bg-primary text-white px-3 py-1 rounded hover:bg-blue-800"
                  >
                    Scan Now
                  </button>
                  <button
                    onClick={() => handleDeleteDomain(domain._id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h2 className="text-xl font-bold mt-8 mb-4">Recent Reports</h2>
        <ReportTable reports={reports} domains={domains} />
      </main>
    </div>
  );
}