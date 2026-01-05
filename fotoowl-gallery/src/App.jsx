import Gallery from "./components/Gallery/Gallery";
import Feed from "./components/Feed/Feed";
import ConnectionStatus from "./components/ConnectionStatus";

const App = () => {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Gallery - takes remaining width and scrolls independently */}
      <div className="flex-1 overflow-hidden">
        <Gallery />
      </div>

      {/* Feed - fixed width on all screen sizes with independent scroll */}
      <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
        <div className="border-b border-gray-200 flex-shrink-0">
          <ConnectionStatus />
        </div>
        <div className="flex-1 overflow-hidden">
          <Feed />
        </div>
      </div>
    </div>
  );
};

export default App;
