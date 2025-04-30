import React from 'react';
import { useState } from 'react';

interface BrokenLink {
  url: string;
  status: string;
  source: string;
}

interface Report {
  _id: string;
  domainId: string;
  brokenLinks: BrokenLink[];
  checkedUrls: string[];
  createdAt: string;
}

interface ReportTableProps {
  reports: Report[];
  domains: { _id: string; url: string }[];
}

export default function ReportTable({ reports, domains }: ReportTableProps) {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const getDomainUrl = (domainId: string) => {
    const domain = domains.find((d) => d._id === domainId);
    return domain ? domain.url : 'Unknown';
  };

  return (
    <div className="card shadow-lg overflow-x-auto">
      {reports.length === 0 ? (
        <p>No reports available.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Date</th>
              <th className="border p-2">Domain</th>
              <th className="border p-2">Broken Links</th>
              <th className="border p-2">URLs Checked</th>
              <th className="border p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <React.Fragment key={report._id}>
                <tr>
                  <td className="border p-2">{new Date(report.createdAt).toLocaleString()}</td>
                  <td className="border p-2">{getDomainUrl(report.domainId)}</td>
                  <td className="border p-2">{report.brokenLinks.length}</td>
                  <td className="border p-2">{report.checkedUrls.length}</td>
                  <td className="border p-2">
                    <button
                      onClick={() => setExpandedReport(expandedReport === report._id ? null : report._id)}
                      className="mt-4 w-full bg-primary text-white p-2 rounded"
                    >
                      {expandedReport === report._id ? 'Hide' : 'Show'} Details
                    </button>
                  </td>
                </tr>
                {expandedReport === report._id && (
                  <tr>
                    <td colSpan={5} className="border p-2">
                      <h3 className="font-bold mb-2">Broken Links</h3>
                      {report.brokenLinks.length === 0 ? (
                        <p>No broken links found.</p>
                      ) : (
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border p-2">URL</th>
                              <th className="border p-2">Status</th>
                              <th className="border p-2">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.brokenLinks.map((link, index) => (
                              <tr key={index}>
                                <td className="border p-2">
                                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                                    {link.url}
                                  </a>
                                </td>
                                <td className="border p-2">{link.status}</td>
                                <td className="border p-2">
                                  <a href={link.source} target="_blank" rel="noopener noreferrer" className="text-primary">
                                    {link.source}
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}