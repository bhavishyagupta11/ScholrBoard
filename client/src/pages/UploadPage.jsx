import { useState } from 'react';

export function UploadPage() {
	const [title, setTitle] = useState('');
	const [category, setCategory] = useState('Certifications');
	const [date, setDate] = useState('');
	const [file, setFile] = useState(null);
	const [previewUrl, setPreviewUrl] = useState(null);

	const onFile = (f) => {
		setFile(f);
		if (f) setPreviewUrl(URL.createObjectURL(f)); else setPreviewUrl(null);
	};

	const submit = (e) => {
		e.preventDefault();
		alert('Submitted (mock)');
	};

	return (
		<div className="space-y-6">
			<h1 className="headline">Upload Activity</h1>
			<form onSubmit={submit} className="card p-4 grid md:grid-cols-2 gap-4">
				<div>
					<label className="block text-sm mb-1 subtle">Title</label>
					<input value={title} onChange={e=>setTitle(e.target.value)} required className="w-full input-dark" />
				</div>
				<div>
					<label className="block text-sm mb-1 subtle">Category</label>
					<select value={category} onChange={e=>setCategory(e.target.value)} className="w-full input-dark">
						{['Certifications','Competitions','Volunteering','Leadership'].map(c=> <option key={c}>{c}</option>)}
					</select>
				</div>
				<div>
					<label className="block text-sm mb-1 subtle">Date</label>
					<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full input-dark" />
				</div>
				<div>
					<label className="block text-sm mb-1 subtle">File Upload</label>
					<input type="file" onChange={e=>onFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
				</div>
				<div className="md:col-span-2">
					<button className="btn btn-primary">Submit</button>
				</div>
			</form>

			{previewUrl && (
				<div className="card p-4">
					<div className="font-medium mb-2">Preview</div>
					<div className="overflow-auto">
						{file?.type?.startsWith('image/') ? (
							<img src={previewUrl} className="max-h-80" />
						) : (
							<a href={previewUrl} target="_blank" className="text-brand-blue underline">Open uploaded file</a>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
