import { uploadJobDescription } from "../services/api";

function JdUpload({ setJdData }) {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await uploadJobDescription(file);
      setJdData({
        jd_text: data.jd_text || "",
        jd_filename: data.jd_filename || file.name,
      });
    } catch (error) {
      alert("Error uploading JD");
    }
  };

  return (
    <div className="card stack">
      <h3>Upload Job Description (PDF)</h3>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
    </div>
  );
}

export default JdUpload;
