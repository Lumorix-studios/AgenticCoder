import { useState } from "react";
import TopMenu from "../components/TopMenu.tsx";

function App() {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");

  return (
    <main className="h-screen flex flex-col bg-zinc-950">

      {/* Top menu */}
      <TopMenu />

      {/* App body */}
      <div className="flex flex-1">

        {/* Sidebar */}
        <aside
          className={`
            h-full
            bg-zinc-900
            border-r
            border-zinc-700
            overflow-hidden
            transition-all
            duration-300
            ${open ? "w-80" : "w-0"}
          `}
        >
          <div className="p-4 w-80 h-full flex flex-col">

            <h2 className="text-white text-xl">
              Agentic Tool
            </h2>

            <div className="flex-1">
              
            </div>

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Send message"
              className="
                w-full
                rounded-xl
                bg-cyan-900
                border
                border-zinc-700
                px-4
                py-3
                text-white
                outline-none
                focus:border-blue-500
              "
            />

          </div>
        </aside>


        {/* Main content */}
        <section className="flex-1 p-5">

          <button
            onClick={() => setOpen(!open)}
            className="
              rounded-lg
              bg-zinc-800
              px-4
              py-2
              text-white
            "
          >
            Toggle chat
          </button>

        </section>

      </div>

    </main>
  );
}

export default App;