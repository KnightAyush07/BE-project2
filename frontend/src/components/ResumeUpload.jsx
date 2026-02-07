import { uploadResume } from "../services/api";

function ResumeUpload({ setCandidateData }) {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await uploadResume(file);
      setCandidateData(data.candidate_info);
    } catch (error) {
      alert("Error uploading resume");
    }
  };

  return (
    <div className="card stack">
      <h3>Upload Resume</h3>
      <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
    </div>
  );
}

export default ResumeUpload;
