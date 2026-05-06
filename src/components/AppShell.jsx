import { Outlet } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import FlashMessage from "./FlashMessage";
import Topbar from "./Topbar";

export default function AppShell() {
  const { flashes, removeFlash } = useAppContext();

  return (
    <div className="app-shell">
      <Topbar />

      <main className="container page-stack">
        <FlashMessage items={flashes} onDismiss={removeFlash} />
        <Outlet />
      </main>
    </div>
  );
}
