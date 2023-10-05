package builder

import (
	"fmt"

	"github.com/tobshub/tobsdb/internals/parser"
	"github.com/tobshub/tobsdb/internals/types"
	"github.com/tobshub/tobsdb/pkg"
	"golang.org/x/exp/slices"
)

func (schema *Schema) Create(t_schema *parser.Table, data map[string]any) (map[string]any, error) {
	row := make(map[string]any)
	for _, field := range t_schema.Fields {
		input := data[field.Name]
		res, err := t_schema.ValidateType(&field, input, true)
		if err != nil {
			return nil, err
		} else {
			if _, ok := field.Properties[types.FieldPropRelation]; ok {
				err := schema.validateRelation(&field, res)
				if err != nil {
					return nil, err
				}
			}
			row[field.Name] = res
		}
	}

	// Enforce id on every table.
	// We do this because "id" field is not required in the schema
	// but a few actions require it - i.e. update and delete queries
	// so even if the user does not define an "id" field,
	// we still have one to work with
	if _, ok := row["id"]; !ok {
		row["id"] = t_schema.CreateId()
	}

	return row, nil
}

func DynamicUpdateVectorField(field, row, input map[string]any) error {
	return nil
}

func (schema *Schema) Update(t_schema *parser.Table, row, data map[string]any) error {
	for field_name, input := range data {
		field, ok := t_schema.Fields[field_name]

		if !ok {
			continue
		}

		switch input := input.(type) {
		case map[string]any:
			switch field.BuiltinType {
			case types.FieldTypeVector:
				// FIXIT: make this more dynamic
				to_push := input["push"].([]any)
				row[field_name] = append(row[field_name].([]any), to_push...)
			case types.FieldTypeInt:
				for k, v := range input {
					_v, err := t_schema.ValidateType(&field, v, true)
					if err != nil {
						return err
					}

					v := _v.(int)
					switch k {
					case "increment":
						row[field_name] = row[field_name].(int) + v
					case "decrement":
						row[field_name] = row[field_name].(int) - v
					}
				}
			}
		default:
			res, err := t_schema.ValidateType(&field, input, false)
			if err != nil {
				return err
			}

			if _, ok := field.Properties[types.FieldPropRelation]; ok {
				err := schema.validateRelation(&field, res)
				if err != nil {
					return err
				}
			}

			row[field_name] = res
		}
	}
	return nil
}

// Note: returns a nil value when no row is found(does not throw errow).
// Always make sure to account for this case
func (schema *Schema) FindUnique(t_schema *parser.Table, where map[string]any) (map[string]any, error) {
	if len(where) == 0 {
		return nil, fmt.Errorf("Where constraints cannot be empty")
	}

	for _, index := range t_schema.Indexes {
		if input, ok := where[index]; ok {
			found := schema.filterRows(t_schema, index, input, true)
			if len(found) > 0 {
				return found[0], nil
			}

			return nil, nil
		}
	}

	if len(t_schema.Indexes) > 0 {
		return nil, fmt.Errorf("Unique fields not included in findUnique request")
	} else {
		return nil, fmt.Errorf("Table does not have any unique fields")
	}
}

func (schema *Schema) Find(t_schema *parser.Table, where map[string]any, allow_empty_where bool) ([]map[string]any, error) {
	found_rows := [](map[string]any){}
	contains_index := false

	if allow_empty_where && len(where) == 0 {
		// nil comparison works here
		found_rows = schema.filterRows(t_schema, "", nil, false)
		return found_rows, nil
	} else if len(where) == 0 {
		return nil, fmt.Errorf("Where constraints cannot be empty")
	}

	// filter with indexes first
	for _, index := range t_schema.Indexes {
		if input, ok := where[index]; ok {
			contains_index = true
			if len(found_rows) > 0 {
				found_rows = pkg.Filter(found_rows, func(row map[string]any) bool {
					s_field := t_schema.Fields[index]
					return t_schema.Compare(&s_field, row[index], input)
				})
			} else {
				found_rows = schema.filterRows(t_schema, index, where[index], false)
			}
		}
	}

	// filter with non-indexes
	if len(found_rows) > 0 {
		for field_name := range t_schema.Fields {
			if !slices.Contains(t_schema.Indexes, field_name) {
				if input, ok := where[field_name]; ok {
					found_rows = pkg.Filter(found_rows, func(row map[string]any) bool {
						s_field := t_schema.Fields[field_name]
						return t_schema.Compare(&s_field, row[field_name], input)
					})
				}
			}
		}
	} else if !contains_index {
		for field_name := range t_schema.Fields {
			if input, ok := where[field_name]; ok {
				found_rows = schema.filterRows(t_schema, field_name, input, false)
			}
		}
	}

	return found_rows, nil
}

func (schema *Schema) Delete(t_schema *parser.Table, row map[string]any) {
	delete(schema.Data[t_schema.Name], pkg.NumToInt(row["id"]))
}
