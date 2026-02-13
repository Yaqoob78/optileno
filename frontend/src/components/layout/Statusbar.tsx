// src/components/layout/StatusBar.tsx - FINAL VERSION
import React from "react";

export default function StatusBar() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800/50">
      <div className="px-6 py-2">
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-400">Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
}