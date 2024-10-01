// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

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
		if(activeTextEditor){
			let curPos = activeTextEditor.selection.active;
			let res = vscode.commands.executeCommand(
				'vscode.executeDocumentHighlights',
				activeTextEditor.document.uri,
				curPos
			);
			let relevantText:String = '';
			res.then((symbols: any) => {
				console.log("symbols", symbols);
				relevantText = symbols.map((symbol: any) => {
					console.log(symbol);
					console.log("-----");
					let highlight = activeTextEditor.document.getText(symbol.range);
							// new vscode.Range(
							// 	symbol.range.start.line, 0,
							// 	symbol.range.end.line, symbol.range.end.character)
					console.log(highlight);
					return highlight;
				})
				.join("\n");
			});
			console.log(relevantText);
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
export function deactivate() {}
