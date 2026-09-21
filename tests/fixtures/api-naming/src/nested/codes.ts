import '../DI_BAG_import_BAD'; // fine: a module path is not a runtime code value

export const doubleQuotedCode = "DI_BAG_cleanup_DOUBLE"; // findings: value-casing code, retired-word code
export const templateCode = `DI_BAG_template_BAD`; // finding: value-casing code
export const lookup = { 'DI_BAG_property_BAD': true }; // fine: a property key is not a runtime code value
export const prose = 'DI_BAG prose BAD'; // fine: prose is not a runtime code
// 'DI_BAG_comment_BAD' is prose in a comment and must stay silent.
