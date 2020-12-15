# vd-view
Repository for https://vd-view.azurewebsites.net/

vd-view is a Viewdata/Videotex web client that can connect to hobby systems that provide Viewdata services over TCP. For example: NXTel, TeeFax, Telstar and CCl4.

The server-side of the project is responsible for managing TCP connections and communicates with web clients using SignalR. All Viewdata processing is performed in the browser.

The project targets .NET 5 and can be run on any platform where the .NET 5 runtime has been installed.
