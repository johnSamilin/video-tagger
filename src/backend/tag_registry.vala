using Gee;

namespace VideoTagger {
    public class TagRegistry : Object {
        private HashMap<string, HashSet<string>> index = new HashMap<string, HashSet<string>>();

        public void index_tags(string video_path, string[] tags) {
            foreach (string tag in tags) {
                if (!index.has_key(tag)) index[tag] = new HashSet<string>();
                index[tag].add(video_path);
            }
        }

        public HashSet<string> evaluate_query(string expression) {
            HashSet<string> result;
            string? error;
            if (!try_evaluate_query(expression, out result, out error)) return new HashSet<string>();
            return result;
        }

        public bool try_evaluate_query(string expression, out HashSet<string> result, out string? error) {
            var tokens = tokenize(expression);
            result = new HashSet<string>();
            error = null;
            if (tokens.size == 0) {
                error = "Enter one or more tag names.";
                return false;
            }
            int position = 0;
            if (!parse_or(tokens, ref position, out result, out error)) return false;
            if (position != tokens.size) {
                error = tokens[position] == ")" ? "Unexpected closing parenthesis." : "Expected 'and' or 'or' between tags.";
                return false;
            }
            return true;
        }

        private bool parse_or(ArrayList<string> tokens, ref int position, out HashSet<string> result, out string? error) {
            result = new HashSet<string>();
            error = null;
            if (!parse_and(tokens, ref position, out result, out error)) return false;
            while (position < tokens.size && tokens[position].down() == "or") {
                position++;
                HashSet<string> right;
                if (!parse_and(tokens, ref position, out right, out error)) return false;
                result = union(result, right);
            }
            return true;
        }

        private bool parse_and(ArrayList<string> tokens, ref int position, out HashSet<string> result, out string? error) {
            result = new HashSet<string>();
            error = null;
            if (!parse_term(tokens, ref position, out result, out error)) return false;
            while (position < tokens.size && tokens[position].down() == "and") {
                position++;
                HashSet<string> right;
                if (!parse_term(tokens, ref position, out right, out error)) return false;
                result = intersect(result, right);
            }
            return true;
        }

        private bool parse_term(ArrayList<string> tokens, ref int position, out HashSet<string> result, out string? error) {
            result = new HashSet<string>();
            error = null;
            if (position >= tokens.size) {
                error = "Expected a tag name after an operator.";
                return false;
            }
            if (tokens[position] == "(") {
                position++;
                if (!parse_or(tokens, ref position, out result, out error)) return false;
                if (position >= tokens.size || tokens[position] != ")") {
                    error = "Missing closing parenthesis.";
                    return false;
                }
                position++;
                return true;
            }
            string tag = tokens[position++];
            if (tag.down() == "and" || tag.down() == "or" || tag == ")") {
                error = "Expected a tag name.";
                return false;
            }
            result = index.has_key(tag) ? copy(index[tag]) : new HashSet<string>();
            return true;
        }

        private ArrayList<string> tokenize(string expression) {
            var tokens = new ArrayList<string>();
            string token = "";
            foreach (unichar character in expression) {
                if (character == '(' || character == ')') {
                    if (token != "") { tokens.add(token); token = ""; }
                    tokens.add(character.to_string());
                } else if (character.isspace()) {
                    if (token != "") { tokens.add(token); token = ""; }
                } else token += character.to_string();
            }
            if (token != "") tokens.add(token);
            return tokens;
        }

        private HashSet<string> copy(HashSet<string> input) {
            var result = new HashSet<string>();
            foreach (string value in input) result.add(value);
            return result;
        }

        private HashSet<string> union(HashSet<string> left, HashSet<string> right) {
            foreach (string value in right) left.add(value);
            return left;
        }

        private HashSet<string> intersect(HashSet<string> left, HashSet<string> right) {
            var result = new HashSet<string>();
            foreach (string value in left) if (right.contains(value)) result.add(value);
            return result;
        }
    }
}
