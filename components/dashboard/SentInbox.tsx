'use client';

import { useState } from 'react';
import { Eye, Clock, User, X } from 'lucide-react';

export default function SentInbox({ outreach }: { outreach: any[] }) {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-medium text-white">Sent Inbox ({outreach.length})</h3>
        <p className="text-sm text-slate-400">View exact AI outreach drafts</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/50 text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Business / Target</th>
              <th className="px-6 py-4 font-medium">Subject Line</th>
              <th className="px-6 py-4 font-medium">Sent At</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {outreach.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No emails have been sent yet.
                </td>
              </tr>
            ) : (
              outreach.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{item.leads?.business_name || 'Unknown Business'}</div>
                    <div className="text-xs text-slate-500 flex items-center mt-1">
                      <User className="w-3 h-3 mr-1" />
                      {item.leads?.email || 'No target email recorded'}
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-slate-300" title={item.subject}>
                    {item.subject}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-slate-400">
                      <Clock className="w-4 h-4 mr-2 text-indigo-400" />
                      {new Date(item.sent_at).toLocaleString('en-US', { 
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedEmail(item)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-md transition-colors text-xs font-medium flex items-center justify-end w-fit ml-auto"
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      View Email
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for viewing HTML Email Content */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold text-white">Email Preview</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Sent to: <span className="text-slate-200">{selectedEmail.leads?.email}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body with Email Subject */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/30">
              <p className="text-sm text-slate-400">Subject:</p>
              <p className="font-medium text-slate-200 text-lg">{selectedEmail.subject}</p>
            </div>

            {/* Email HTML Viewer iframe (sandboxed) */}
            <div className="flex-1 overflow-auto bg-white m-5 rounded-lg border border-slate-200 shadow-inner">
              <iframe 
                srcDoc={selectedEmail.body_html || `<p>${selectedEmail.body_text}</p>`}
                className="w-full h-full min-h-[400px]"
                sandbox="allow-same-origin"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
