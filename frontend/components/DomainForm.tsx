import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

interface DomainFormProps {
  onAdd: () => void;
  domainCount: number;
  plan: string;
}

export default function DomainForm({ onAdd, domainCount, plan }: DomainFormProps) {
  const [url, setUrl] = useState('');
  const [schedule, setSchedule] = useState('daily');
  const [isValidUrl, setIsValidUrl] = useState(true);

  const planLimits = { free: 1, basic: 5, advanced: Infinity };

  useEffect(() => {
    // Validate URL format
    const valid = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(url);
    setIsValidUrl(valid || url === '');
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUrl) {
      toast.error('Invalid URL format');
      return;
    }
    if (domainCount >= planLimits[plan]) {
      toast.error(`Plan limit reached (${planLimits[plan]} domains)`);
      return;
    }
    const token = localStorage.getItem('token');
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/domains`,
        { url, schedule },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUrl('');
      setSchedule('daily');
      toast.success('Domain added');
      if (onAdd) onAdd();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add domain');
    }
  };

  return (
    <div className="card mb-4 shadow-lg p-4">
      <h2 className="text-xl font-bold mb-4">Add Domain</h2>
      <form onSubmit={handleSubmit}>
      <div className="row">
      <div className='col'>
          <label className="block mb-1">Website URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`w-full p-2 form-control border rounded ${!isValidUrl && url ? 'border-red-500' : ''}`}
            placeholder="https://example.com"
            required
          />
          {!isValidUrl && url && <p className="text-red-500 text-sm mt-1">Invalid URL format</p>}
        </div>
        <div className="col">
          <label className="block mb-1">Report Schedule</label>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="w-full p-2 border form-control rounded"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            {plan === 'advanced' && <option value="monthly">Monthly</option>}
          </select>
        </div>

      </div>
       
        
        <button
          type="submit"
          className="mt-4 w-full bg-primary text-white p-2 rounded hover:bg-blue-800"
          disabled={!isValidUrl || !url}
        >
          Add Domain
        </button>
      </form>
    </div>
  );
}