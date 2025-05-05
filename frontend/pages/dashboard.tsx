'use client';

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
  const [scanning, setScanning] = useState<{ [key: string]: boolean }>({});
  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { session_id } = router.query;

  useEffect(() => {
    fetchData();
    if (session_id) {
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
    setScanning((prev) => ({ ...prev, [domainId]: true }));

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reports/scan/${domainId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success('Scan started');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to start scan');
    } finally {
      setScanning((prev) => ({ ...prev, [domainId]: false }));
    }
  };

  const planLimits = { free: 1, basic: 5, advanced: 'Unlimited' };
  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic':
        return 'bg-info';
      case 'advanced':
        return 'bg-success';
      case 'free':
      default:
        return 'bg-danger';
    }
  };

  return (
    <div className='bg-light'>
      <Head>
        <title>Dashboard - Website Link Checker</title>
        <meta name="description" content="Manage your domains and view broken link reports." />
      </Head>
      <Navbar />
      <main className="container py-5">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

        <div className="card mb-4 shadow-lg">
          <div className="card-body d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              {/* Plan Icon and Name */}
              {plan === 'free'}
              {plan === 'basic'}
              {plan === 'advanced'}
              <h5 className={`card-title text-${plan === 'free' ? 'danger' : plan === 'basic' ? 'info' : 'success'}`}>
                {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
              </h5>
            </div>
            <div className="text-end">
              <p>Domains: {domains.length} / {planLimits[plan]}</p>
              {/* Progress bar */}
              <div className="progress" style={{ height: '10px' }}>
                <div className={`progress-bar ${getPlanColor(plan)}`}
                  role="progressbar"
                  style={{ width: `${(domains.length / (typeof planLimits[plan] === 'number' ? planLimits[plan] : 1)) * 100}%` }}
                  aria-valuenow={domains.length}
                  aria-valuemin={0}
                  aria-valuemax={planLimits[plan] === 'Unlimited' ? 100 : planLimits[plan]}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <DomainForm onAdd={fetchData} domainCount={domains.length} plan={plan} />






        <div className="card mb-4 shadow-lg">
          <div className='p-4'>
            <h2 className="text-xl font-bold ">Your Domains</h2>
          </div>

          {/* Loading, Empty, or Domains */}
          {loading ? (
            <p className="text-gray-600">Loading domains...</p>
          ) : domains.length === 0 ? (
            <p className="text-gray-600">No domains added yet.</p>
          ) : (
            <div className="card-body">
              <div className="d-flex flex-column space-y-4">
                {domains.map((domain) => (
                  <div
                    key={domain._id}
                    className="d-flex justify-content-between items-center p-4 bg-white shadow-md rounded-lg hover:shadow-xl transition-shadow duration-300"
                  >
                    <div className="flex flex-col">
                      <span className="text-lg fw-bold">{domain.url}</span> -
                      <span className="badge rounded-pill text-bg-success" > {domain.schedule}</span>
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleManualScan(domain._id)}
                        className="mt-4 w-full bg-primary text-white p-2 rounded me-3"
                        disabled={scanning[domain._id]}
                      >
                        {scanning[domain._id] ? (
                          <span>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Scanning...
                          </span>
                        ) : (
                          'Scan Now'
                        )}
                      </button>
                      {/* <button
                onClick={() => handleManualScan(domain._id)}
                className="mt-4 w-full bg-primary text-white p-2 rounded me-3"
              >
                Scan Now
              </button> */}
                      <button
                        onClick={() => handleDeleteDomain(domain._id)}
                        className="mt-4 w-full bg-danger text-white p-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        <h2 className="text-xl font-bold mt-8 mb-4">Recent Reports</h2>
        <ReportTable reports={reports} domains={domains} />
      </main>
    </div>
  );
}
