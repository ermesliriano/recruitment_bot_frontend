import { useEffect, useState } from "react";

const API = "https://recruitment-api.onrender.com";

export default function App() {
  const [ranking, setRanking] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch(`${API}/admin/ranking`)
      .then(r => r.json())
      .then(setRanking);
  }, []);

  const createVacancy = async () => {
    await fetch(`${API}/vacancies`, {
      method: "POST",
      headers: { 
	    "Content-Type": "application/json",
	    Authorization: `Bearer ${ADMIN_TOKEN}`,	  
	  },
      body: JSON.stringify({
        title,
        description: "Nueva vacante desde UI"
      })
    });

    alert("Vacante creada");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Recruitment Dashboard</h1>

      <h2>Crear vacante</h2>
      <input
        placeholder="Título"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <button onClick={createVacancy}>Crear</button>

      <h2>Top candidatos</h2>
      <ul>
        {ranking.map((r, i) => (
          <li key={i}>
            {r.name} - {r.score} ({r.status})
          </li>
        ))}
      </ul>
    </div>
  );
}