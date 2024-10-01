// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from "fs";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-context-poc" is now active!');


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('code-context-poc.helloWorld', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from code-context-poc!');
		// await vscode.commands.executeCommand('editor.action.triggerSuggest');
		// await vscode.commands.executeCommand('acceptSelectedSuggestion');
		let activeTextEditor = vscode.window.activeTextEditor;
		if (activeTextEditor) {
			let getMethodContext = async () => {
				let curPos = activeTextEditor.selection.active;
				let symbols: any = await vscode.commands.executeCommand(
					'vscode.executeDocumentSymbolProvider',
					activeTextEditor.document.uri
				);
				let relevantText: String = '';
				console.log("symbols", symbols);
				relevantText = symbols
					.filter((symbol: any) =>
						symbol.range.start.line <= curPos.line
						&& curPos.line <= symbol.range.end.line)
					.map((symbol: any) => {
						console.log(symbol);
						console.log("-----");
						let highlight = activeTextEditor.document
							.getText(new vscode.Range(
								Math.max(0, symbol.range.start.line - 2),
								0,
								Math.min(symbol.range.start.line + 5, symbol.range.end.line),
								Math.max(symbol.range.end.character, 100)));
						console.log(highlight);
						return highlight;
					})
					.join("\n");
				relevantText = [relevantText, "// "+activeTextEditor.document.uri].join("\n");
				console.log(relevantText);
				return relevantText;
			};
			let getDefinitionContext = async () => {
				let curPos = activeTextEditor.selection.active;
				let locations: any = await vscode.commands.executeCommand(
					'vscode.executeDefinitionProvider',
					activeTextEditor.document.uri,
					curPos
				);
				let relevantText: String = "";
				console.log("locations", locations);
				for(let location of locations){
					console.log(location);
					console.log("-----");
					let document: any = await vscode.workspace.openTextDocument(location.targetUri);
					debugger;
					let text = document
					.getText(new vscode.Range(
						Math.max(0, location.targetSelectionRange.start.line - 2),
						0,
						location.targetSelectionRange.start.line + 5,
						Math.max(location.targetSelectionRange.end.character, 100)));
					// .getText(location.targetSelectionRange);
					console.log("text", text);
					relevantText = [relevantText, "// "+activeTextEditor.document.uri].join("\n");
					relevantText = [relevantText, text].join("\n");
				}
				console.log(relevantText);
				return relevantText;
			};


			let betterCodeContext = [
				await getMethodContext(),
				await getDefinitionContext()]
				.join("\n");

			console.log("-----BETTER CONTEXT BEGIN-----------");
			console.log(betterCodeContext);
			console.log("-----BETTER CONTEXT END-----------");
		}
		// vscode.commands.executeCommand('codelens.showLensesInCurrentLine');
		// let commands = await vscode.commands.getCommands();
		// commands.forEach((cmd) => console.log(cmd));
		// on("autocomplete/complete", async (msg) => {

		// 	const outcome =
		// 	  await this.completionProvider.provideInlineCompletionItems(
		// 		msg.data,
		// 		undefined,
		// 	  );
		// 	return outcome ? [outcome.completion] : [];
		//   });
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
