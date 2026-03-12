import React, { useState } from 'react';

interface BrokenLink {
  text: string;
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
    <div className="card shadow-lg">
      {reports.length === 0 ? (
        <p className="p-4">No reports available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
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
                    <td className="border p-2 whitespace-nowrap">
                      {new Date(report.createdAt).toLocaleString()}
                    </td>
                    <td className="border p-2 break-words">{getDomainUrl(report.domainId)}</td>
                    <td className="border p-2 text-center">{report.brokenLinks.length}</td>
                    <td className="border p-2 text-center">{report.checkedUrls.length}</td>
                    <td className="border p-2 text-center">
                      <button
                        onClick={() =>
                          setExpandedReport(expandedReport === report._id ? null : report._id)
                        }
                        className="bg-primary text-white px-3 py-1 rounded hover:opacity-80 transition"
                      >
                        {expandedReport === report._id ? 'Hide' : 'Show'} Details
                      </button>
                    </td>
                  </tr>

                  {expandedReport === report._id && (
                    <tr>
                      <td colSpan={5} className="border p-4 bg-gray-50">
                        {/* Broken Links Section */}
                        <div className="mb-4">
                          <h3 className="font-bold mb-2 text-lg">Broken Links</h3>
                          {report.brokenLinks.length === 0 ? (
                            <p>No broken links found.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">URL</th>
                                    <th className="border p-2 text-center">Status</th>
                                    <th className="border p-2 text-left">Text</th>
                                    <th className="border p-2 text-left">Source</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {report.brokenLinks.map((link, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td style={{maxWidth:'200px'}} className="border p-2 text-left max-w-96 truncate">
                                        <a
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary underline"
                                          title={link.url} // shows full URL on hover
                                        >
                                          {link.url}
                                        </a>
                                      </td>
                                      <td className="border p-2 text-center">{link.status}</td>
                                      <td style={{maxWidth:'200px'}} className="border p-2 text-left">
                                        {link.text || <span className="text-gray-400">No text</span>}
                                      </td>
                                      <td style={{maxWidth:'200px'}} className="border p-2 text-left max-w-xs truncate">
                                        <a
                                          href={link.source}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary underline"
                                        >
                                          {link.source}
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>



                        {/* Checked URLs Section */}
                        <div>
                          <h3 className="font-bold mb-2 text-lg">Checked URLs</h3>
                          {report.checkedUrls.length === 0 ? (
                            <p>No URLs were checked.</p>
                          ) : (
                            <ul className="list-disc list-inside space-y-1">
                              {report.checkedUrls.map((url, index) => (
                                <li key={index} className="break-words">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline"
                                  >
                                    {url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}