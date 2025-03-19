# Note that the site is currently down while I assess the impact of the UK Online Safety Act
  
# vd-view
Repository for https://vd-view.azurewebsites.net/

vd-view is a Viewdata/Videotex web client that can connect to hobby systems that provide Viewdata services over TCP. For example: NXTel, TeeFax, Telstar and CCl4.

The server-side of the project is responsible for managing TCP connections and communicates with web clients using SignalR. All Viewdata processing is performed in the browser.

The project targets .NET 5 and can be run on any platform where the .NET 5 runtime has been installed.

## Running it Locally
### Prerequisites

The following must be installed
1. .NET 5 SDK
1. Node.js
1. Git
  
### Build Steps

Install the dotnet LibMan CLI
1. dotnet tool install -g Microsoft.Web.LibraryManager.Cli

From the terminal in a directory of your choice:
1. git clone https://github.com/simonlaszcz/vd-view.git
1. cd vd-view
1. npm install
1. cd ViewDataViewer
1. npm install
1. libman restore
1. dotnet run
1. Browse to https://localhost:5000
