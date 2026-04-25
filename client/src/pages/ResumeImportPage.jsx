import { useState } from 'react';

export function ResumeImportPage() {
	const [text, setText] = useState('');
	const [fileName, setFileName] = useState('');

	const onFile = async (file) => {
		if (!file) return;
		setFileName(file.name);
		const content = await file.text();
		setText(content.slice(0, 5000));
	};

	const quickAdd = () => alert('Parsed resume fields mapped to profile and activities (mock).');

	return (
		<div className="space-y-6">
			<h1 className="headline">Resume Import</h1>
			<div className="card p-4">
				<div className="flex items-center gap-3">
					<input type="file" accept=".txt,.md,.pdf,.doc,.docx" onChange={e=>onFile(e.target.files?.[0] ?? null)} />
					{fileName && <div className="text-sm subtle">{fileName}</div>}
					<button className="btn btn-primary" onClick={quickAdd}>Auto-fill Profile & Activities</button>
				</div>
				{text && (
					<div className="mt-4">
						<div className="text-sm subtle mb-1">Preview (first 5,000 chars)</div>
						<pre className="surface p-3 text-sm whitespace-pre-wrap max-h-72 overflow-auto">{text}</pre>
					</div>
				)}
			</div>
		</div>
	);
}
