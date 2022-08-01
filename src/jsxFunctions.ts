import ts from '../node_modules/typescript/lib/typescript.js';
import path from 'path';

const startNewExecution = (fileName: string) => {
  const program = ts.createProgram([fileName], {
		target: ts.ScriptTarget.ES2015,
		module: ts.ModuleKind.CommonJS,
	});
  const typeChecker = program.getTypeChecker();

	const files = program
		.getSourceFiles()
		.filter(
			file =>
				file.fileName.indexOf('node_modules') === -1 &&
				!file.isDeclarationFile,
		);

	const [selectedFile] = files.filter(
		file => path.normalize(file.fileName) === fileName,
	);

	return {
		typeChecker,
		selectedFile,
	};
}

type FunctionNode = ts.FunctionDeclaration | ts.MethodDeclaration;

const isFunctionNode = (node: FunctionNode): boolean => {
	return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node);
}

const getFunctionNodes = (node: ts.Node): FunctionNode[] => {
	return node.getChildren().reduce(
		(acc, child) => {
			if (isFunctionNode(child as FunctionNode)) {
				acc.push(child as FunctionNode);
			}

			return [...acc, ...getFunctionNodes(child as FunctionNode)];
		},
		[] as FunctionNode[],
	);
}

type jsxFunctions = {
  [key:string]: boolean
};

const filterJsxFunctionsFromNode = (
  node: FunctionNode,
  typeChecker: ts.TypeChecker
): jsxFunctions => {
  const typeOfFunction = typeChecker.getTypeAtLocation(node);
	const parentSym = typeChecker.getSymbolAtLocation(node.parent.getChildAt(0));
  const jsxFuncs: jsxFunctions = {}

	typeOfFunction.getCallSignatures().map(signature => {
		const type = signature.getReturnType();
		// @ts-ignore
		const element = type.symbol?.escapedName, jsx = type.symbol?.parent?.escapedName;
		const props = type.getProperties();
		// @ts-ignore
		const reactelement = props[0]?.parent?.escapedName;
		if(element === "Element" && jsx === "JSX" && reactelement === "ReactElement") {
			const name = (
        parentSym?.getEscapedName()?.toString() ||
        parentSym?.getName()?.toString() ||
        // @ts-ignore
        node.localSymbol?.escapedName ||
        // @ts-ignore
        node.symbol?.escapedName
      );
      if(name !== "__function")
			  jsxFuncs[name] = true;
		}
	});

  return jsxFuncs;
}

const filterJsxFunctionsFromNodes = (
	nodes: FunctionNode[],
	typeChecker: ts.TypeChecker,
): jsxFunctions => {
	return nodes.reduce(
		(acc, node) => {
      return {
        ...acc,
        ...filterJsxFunctionsFromNode(node, typeChecker)
      }
    },
		{},
	);
}

export const getJsxFunctions = (fileName: string): jsxFunctions => {
  const { selectedFile, typeChecker } = startNewExecution(fileName);
	const allFunctions = getFunctionNodes(selectedFile);

	return filterJsxFunctionsFromNodes(allFunctions, typeChecker);
}