import { openUrl } from "@tauri-apps/plugin-opener";
interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
export default function InfoPanel({ isOpen, onClose }: InfoPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100">Information</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5 text-sm text-zinc-400">
        
            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-5 shadow-lg">
              <h3 className="text-zinc-100 font-semibold text-base mb-3">
                About us
              </h3>
        
              <p className="leading-relaxed text-zinc-400 mb-4">
                Made by <span className="text-zinc-200 font-medium">Lumorix Studios</span>.
                A GitHub organization for our projects, not a registered company.
              </p>
        
              <button
                onClick={async () => {
                  try {
                    await openUrl("https://github.com/Lumorix-studios/AgenticCoder");
                  } catch (error) {
                    console.error("Failed to open URL:", error);
                  }
                }}
                className="
                  w-full flex items-center justify-center gap-2
                  px-4 py-2.5
                  bg-zinc-700/50 hover:bg-zinc-700
                  border border-zinc-600
                  rounded-lg
                  text-blue-400 hover:text-blue-300
                  transition-all duration-200
                "
              >
                View GitHub Repository
              </button>
            </div>
        
        
            <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-5 shadow-lg">
              <h3 className="text-zinc-100 font-semibold text-base mb-3">
                Contact us
              </h3>
        
              <div className="space-y-3">
        
                <button
                  onClick={async () => {
                    try {
                      await openUrl(
                        "mailto:madhusudhant207@gmail.com?subject=Inquiries"
                      );
                    } catch (error) {
                      console.error("Failed to open email:", error);
                    }
                  }}
                  className="
                    w-full flex items-center justify-between
                    px-4 py-3
                    bg-zinc-900/50 hover:bg-zinc-800
                    border border-zinc-700
                    rounded-lg
                    transition-all duration-200
                  "
                >
                  <span className="text-zinc-300">
                    Email
                  </span>
        
                  <span className="text-cyan-400">
                    madhusudhant207@gmail.com
                  </span>
                </button>
        
        
                <button
                  onClick={async () => {
                    try {
                      await openUrl("tel:+17722590947");
                    } catch (error) {
                      console.error("Failed to open phone:", error);
                    }
                  }}
                  className="
                    w-full flex items-center justify-between
                    px-4 py-3
                    bg-zinc-900/50 hover:bg-zinc-800
                    border border-zinc-700
                    rounded-lg
                    transition-all duration-200
                  "
                >
                  <span className="text-zinc-300">
                    Phone
                  </span>
        
                  <span className="text-cyan-400">
                    +1 (772) 259-0947
                  </span>
                </button>
        
              </div>
            </div>
        
        
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-sm rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}