function TopMenu() {
  return (
    <nav className="
      h-10
      bg-zinc-900
      border-b
      border-zinc-700
      flex
      items-center
      px-3
      text-white
    ">

      <button className="px-3 hover:bg-zinc-800 rounded"
        onClick={() => alert("Clicked files") }
      >
        File
      </button>

      <button className="px-3 hover:bg-zinc-800 rounded">
        Edit
      </button>

      <button className="px-3 hover:bg-zinc-800 rounded">
        View
      </button>

      <button className="px-3 hover:bg-zinc-800 rounded">
        Settings
      </button>

    </nav>
  );
}

export default TopMenu;