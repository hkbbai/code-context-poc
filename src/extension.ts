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

	const config = {
		"NORMAL_LINES_LOOK_BEHIND": 50,
		"ENHANCED_LINES_LOOK_BEHIND": 50,
		"ENHANCED_LINES_LOOK_AHEAD": 5,
		"ENHANCED_LINES_CONTENT_LIMIT": 50
	};

	const isValidLocation = (location: any) => {
		return location.targetRange 
			&& !location.targetRange.isSingleLine
			&& isOwnMethod(location.targetUri);
	};
	const isOwnMethod = (uri: vscode.Uri) => {
		return !uri.path.includes("node_modules");
	};
	const getNLines = (activeTextEditor: vscode.TextEditor, startLine: number, linesCount:number) => {
		let lines = [];
		for (let lineIndex = 0; lineIndex < linesCount; lineIndex++) {
			lines.push( activeTextEditor.document.lineAt(startLine + lineIndex).text);
		}
		return lines.join("\n");
	};
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
			const curPos = activeTextEditor.selection.active;
			let getMethodContext = async () => {
				let symbols: any = await vscode.commands.executeCommand(
					'vscode.executeDocumentSymbolProvider',
					activeTextEditor.document.uri
				);
				let relevantText: String = '';
				console.log("symbols", symbols);
				if(!symbols){
					return '';
				}
				// @TODO: append line information if needed
				relevantText = symbols
					.filter((symbol: any) =>
						symbol.range.start.line <= curPos.line
						&& curPos.line <= symbol.range.end.line)
					.map((symbol: any) => {
						return getNLines(activeTextEditor, symbol.range.start.line, config.ENHANCED_LINES_LOOK_AHEAD);
					})
					.join("\n");
				relevantText = ["// " + activeTextEditor.document.uri, relevantText, ""].join("\n");
				console.log("relevantText", relevantText);
				return relevantText;
			};

			let seenCode = new Set();
			
			let getDefinitionContext = async () => {
				let positions = [curPos];
				let relevantText: string = "";
				for (let diff = 0; diff < config.ENHANCED_LINES_LOOK_BEHIND && (curPos.line - diff) >= 0; diff++) {
					let lineContent: string = activeTextEditor.document.lineAt(curPos.line - diff).text;
					// words before '.' or '(' be an object or function calls, will help in providing more context
					for (let i = 0; i < lineContent.length; i++) {
						let ch = lineContent.charAt(i);
						if (ch == "." || ch == '(') {
							positions.push(new vscode.Position(curPos.line - diff, i - 1));
						}
					}
				}
				console.log("positions", positions);
				for (let position of positions) {
					let locations: any = await vscode.commands.executeCommand(
						'vscode.executeDefinitionProvider',
						activeTextEditor.document.uri,
						position
					);
					console.log("locations", locations);
					for (let location of locations) {
						if (isValidLocation(location)) {
							console.log("valid location", location);
							let document: any = await vscode.workspace.openTextDocument(location.targetUri);
							let text = getNLines(activeTextEditor, location.targetRange.start.line, config.ENHANCED_LINES_LOOK_AHEAD);
							text = text.trim();
							if (text.length > 0 && !seenCode.has(text)) {
								seenCode.add(text);
								relevantText += [ "// " + document.uri, text, ""].join("\n");
							}
						}
					}
				}
				console.log("relevantText", relevantText);
				//  @TODO: remove duplicates, cap to 50 lines, include direct context at the end(50 lines)
				return relevantText;
			};


			let combinedCodeContext:string = [
				await getDefinitionContext(),
				await getMethodContext()]
				.join("\n");
			console.log("combinedCodeContext", combinedCodeContext);

			let betterCodeContext:string = combinedCodeContext
				.split("\n")
				.slice(0, config.ENHANCED_LINES_CONTENT_LIMIT)
				.join("\n");

			let getNormalContext = () => {
				return [ "// " + activeTextEditor.document.uri,
					activeTextEditor.document.getText(new vscode.Range(
						Math.max(0, curPos.line - config.NORMAL_LINES_LOOK_BEHIND), 0, curPos.line, curPos.character))].join("\n");
			};
			let normalContext = getNormalContext();
			// final enhanced code context includes better and normal code context
			let finalCodeContext = [betterCodeContext, normalContext].join("\n");

			console.log("-----BETTER CONTEXT BEGIN-----------");
			console.log(finalCodeContext);
			console.log("-----BETTER CONTEXT END-----------");
			fs.writeFile('/tmp/enhanced.txt', finalCodeContext, (err)=> console.log);
			fs.writeFile('/tmp/normal.txt', normalContext, (err)=> console.log(err));
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
