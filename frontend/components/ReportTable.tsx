<<<<<<< HEAD
import React from 'react';
import { useState } from 'react';
=======
import React, { useState } from 'react';
>>>>>>> main

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
<<<<<<< HEAD
    <div className="card shadow-lg overflow-x-auto">
      {reports.length === 0 ? (
        <p>No reports available.</p>
      ) : (
=======
    <div className="card shadow-lg">
      {reports.length === 0 ? (
        <p className="p-4">No reports available.</p>
      ) : (
<<<<<<< HEAD
>>>>>>> main
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
                  <td className="border p-2 ds">{new Date(report.createdAt).toLocaleString()}</td>
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
    <td colSpan={5} className="border p-4 bg-gray-50">
      {/* Broken Links Section */}
      <div className="mb-4">
        <h3 className="font-bold mb-2 text-lg">Broken Links</h3>
        {report.brokenLinks.length === 0 ? (
          <p>No broken links found.</p>
        ) : (
          <table className="w-full border-collapse mb-4">
<<<<<<< HEAD
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">URL</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Text</th>
                <th className="border p-2">Source</th>
=======
=======
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border p-2">Date</th>
                <th className="border p-2">Domain</th>
                <th className="border p-2">Broken Links</th>
                <th className="border p-2">URLs Checked</th>
                <th className="border p-2">Details</th>
>>>>>>> main
              </tr>
            </thead>
             {/* {console.log(typeof report.brokenLinks[9].status,'report.brokenLinks')} */}
            <tbody>
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> main
              {report.brokenLinks
              .filter(link => link.status === "404" )
  .map((link, index) => (
    <tr key={index}>
      <td style={{ maxWidth: '200px' }} className="border p-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary"
        >
          {link.url}
        </a>
      </td>
      <td className="border p-2">{link.status}</td>
      <td style={{ maxWidth: '200px' }} className="border p-2">
        {link.text}
      </td>
      <td style={{ maxWidth: '200px' }} className="border p-2">
        <a
          href={link.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary"
        >
          {link.source}
        </a>
      </td>
    </tr>
  ))}
<<<<<<< HEAD
            </tbody>
          </table>
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
              <li key={index}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary">
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
      )}
    </div>
  );
}
=======
=======
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
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
>>>>>>> main
